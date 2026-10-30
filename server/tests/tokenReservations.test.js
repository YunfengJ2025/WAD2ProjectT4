const { test } = require('node:test');
const assert = require('node:assert/strict');
const users = require('../models/userModel');
const tokens = require('../models/tokenModel');

// Exercise reservation rules with database operations stubbed out. These tests
// check query guards and rollback behavior; they do not require a live MongoDB.

test('balances distinguish total, frozen and available, including legacy users', () => {
  assert.deepEqual(users.tokenSummary({ tokenBalance: 50, tokenReservations: [
    { requestId: 7, amount: 20 }, { requestId: 8, amount: 5 }, { requestId: 9, amount: 0 },
  ] }), { tokenBalance: 50, frozenTokenBalance: 25, availableTokenBalance: 25,
    tokenReservations: [{ requestId: 7, amount: 20 }, { requestId: 8, amount: 5 }] });
  assert.equal(users.tokenSummary({ tokenBalance: 50 }).availableTokenBalance, 50);
});

test('reservations use an atomic available-balance condition and reject insufficient funds', async () => {
  const original = users.User.updateOne;
  try {
    users.User.updateOne = async (filter, update) => {
      assert.equal(filter.userId, 1);
      assert.deepEqual(filter.$expr.$gte, [
        { $subtract: ['$tokenBalance', { $sum: { $ifNull: ['$tokenReservations.amount', []] } }] }, 20,
      ]);
      assert.deepEqual(update.$push.tokenReservations, { requestId: 7, amount: 20 });
      return { modifiedCount: 0 };
    };
    await assert.rejects(users.reserveTokens(1, 7, 20), { status: 400 });
    await assert.rejects(users.reserveTokens(1, 7, 1.5), { status: 400 });
  } finally { users.User.updateOne = original; }
});

test('care payouts consume reserved funds and restore them if crediting fails', async () => {
  const originalUpdate = users.User.updateOne;
  const originalClaim = tokens.TokenTransaction.findOneAndUpdate;
  const originalReset = tokens.TokenTransaction.updateOne;
  const writes = [];
  try {
    tokens.TokenTransaction.findOneAndUpdate = async () => ({ _id: 'txn', senderId: 1, receiverId: 2, amount: 10, requestId: 7 });
    tokens.TokenTransaction.updateOne = async () => ({});
    users.User.updateOne = async (filter, update) => {
      writes.push({ filter, update });
      if (filter.userId === 2) return { matchedCount: 0 };
      return { modifiedCount: 1 };
    };
    await assert.rejects(users.applyTransactionToBalances(1), { status: 404 });
    assert.deepEqual(writes[0].filter.tokenReservations, { $elemMatch: { requestId: 7, amount: { $gte: 10 } } });
    assert.deepEqual(writes[0].update.$inc, { tokenBalance: -10, 'tokenReservations.$.amount': -10 });
    assert.deepEqual(writes[2].update.$inc, { tokenBalance: 10, 'tokenReservations.$.amount': 10 });
  } finally {
    users.User.updateOne = originalUpdate;
    tokens.TokenTransaction.findOneAndUpdate = originalClaim;
    tokens.TokenTransaction.updateOne = originalReset;
  }
});

test('removed shop purchases and fractional amounts are rejected', async () => {
  await assert.rejects(tokens.createTransaction({ type: 'SHOP_PURCHASE', amount: 5 }), { status: 400 });
  await assert.rejects(tokens.createTransaction({ type: 'SYSTEM_GIFT', receiverId: 1, amount: 1.5 }), { status: 400 });
});

test('posting reserves every daily visit and removes an unfunded request', async () => {
  const CareRequest = require('../models/careRequestModel');
  const CareVisit = require('../models/careVisitModel');
  const RequestItem = require('../models/requestItemModel');
  const { Plant } = require('../models/plantModel');
  const originals = [CareRequest.create, CareVisit.create, RequestItem.create, Plant.findOne, users.User.updateOne];
  let amount;
  let removed = false;
  let insufficient = false;
  let visits = 0;
  try {
    Plant.findOne = async () => ({});
    CareRequest.create = async (data) => ({ ...data, requestId: 7,
      save: async () => {}, deleteOne: async () => { removed = true; }, toObject() { return { ...this }; } });
    CareVisit.create = async () => ({ visitId: ++visits, deleteOne: async () => {} });
    RequestItem.create = async () => ({ deleteOne: async () => {} });
    users.User.updateOne = async (filter) => {
      if (filter.$expr) { amount = filter.$expr.$gte[1]; return { modifiedCount: insufficient ? 0 : 1 }; }
      return { modifiedCount: 1 };
    };
    const controller = require('../controllers/careRequestController');
    const req = { userId: 1, body: { plantId: 1, startDate: '2026-11-01', endDate: '2026-11-03', tokenReward: 10 } };
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    await controller.create(req, res);
    assert.equal(res.code, 201);
    assert.equal(amount, 30);
    assert.equal(visits, 3);
    assert.equal(res.body.request.status, 'open');
    insufficient = true;
    await controller.create(req, res);
    assert.equal(res.code, 400);
    assert.equal(removed, true);
    assert.equal(visits, 3);
  } finally {
    [CareRequest.create, CareVisit.create, RequestItem.create, Plant.findOne, users.User.updateOne] = originals;
  }
});

test('cancellation releases only cancelled visits, retaining completed unpaid rewards', async () => {
  const CareRequest = require('../models/careRequestModel');
  const CareVisit = require('../models/careVisitModel');
  const RequestItem = require('../models/requestItemModel');
  const originals = [CareRequest.findOne, CareVisit.exists, CareVisit.updateMany, CareVisit.find, RequestItem.updateMany, users.User.updateOne];
  let release;
  try {
    CareRequest.findOne = async () => ({ requestId: 7, tokenReward: 10, save: async () => {} });
    CareVisit.exists = async () => false;
    CareVisit.updateMany = async () => ({ modifiedCount: 2 });
    CareVisit.find = () => ({ select: () => ({ lean: async () => [{ visitId: 1 }, { visitId: 2 }, { visitId: 3 }] }) });
    RequestItem.updateMany = async () => ({});
    users.User.updateOne = async (filter, update) => { release = update.$inc['tokenReservations.$.amount']; return { modifiedCount: 1 }; };
    const controller = require('../controllers/careRequestController');
    const res = { status() { return this; }, json() {} };
    await controller.cancel({ userId: 1, params: { requestId: 7 } }, res);
    assert.equal(release, -20);
  } finally {
    [CareRequest.findOne, CareVisit.exists, CareVisit.updateMany, CareVisit.find, RequestItem.updateMany, users.User.updateOne] = originals;
  }
});

test('care endpoint derives rewards from the completed visit rather than client amounts', async () => {
  const CareVisit = require('../models/careVisitModel');
  const CareRequest = require('../models/careRequestModel');
  const PhotoProof = require('../models/photoProofModel');
  const controller = require('../controllers/tokenController');
  const originals = [CareVisit.findOne, CareRequest.findOne, PhotoProof.exists, tokens.createTransaction, users.applyTransactionToBalances];
  let payload;
  try {
    CareVisit.findOne = async (filter) => {
      assert.equal(filter.sitterId, 2);
      assert.equal(filter.status, 'completed');
      return { visitId: 3, requestId: 7, sitterId: 2 };
    };
    CareRequest.findOne = async () => ({ requestId: 7, ownerId: 1, tokenReward: 10 });
    PhotoProof.exists = async () => true;
    tokens.createTransaction = async (data) => { payload = data; return { transactionId: 4 }; };
    users.applyTransactionToBalances = async () => ({ receiverBalance: 60 });
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    await controller.createTokenTran({ userId: 2, body: { type: 'CARE', visitId: 3, amount: 9999, senderId: 99 } }, res);
    assert.equal(res.code, 201);
    assert.equal(payload.amount, 10);
    assert.equal(payload.senderId, 1);
    assert.equal(payload.requestId, 7);
    PhotoProof.exists = async () => false;
    await controller.createTokenTran({ userId: 2, body: { type: 'CARE', visitId: 3 } }, res);
    assert.equal(res.code, 400);
  } finally {
    [CareVisit.findOne, CareRequest.findOne, PhotoProof.exists, tokens.createTransaction, users.applyTransactionToBalances] = originals;
  }
});
