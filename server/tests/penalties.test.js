const { test } = require("node:test");
const assert = require("node:assert/strict");
const tokens = require("../models/tokenModel");
const users = require("../models/userModel");
const controller = require("../controllers/tokenController");

test("penalty endpoint creates a sender-only debit, validates input and cleans up failed payments", async () => {
  const originals = [
    tokens.createTransaction,
    users.applyTransactionToBalances,
    tokens.TokenTransaction.deleteOne,
  ];
  let payload;
  let deleted;
  let fail = false;
  try {
    tokens.createTransaction = async (data) => {
      payload = data;
      return { _id: "penalty", transactionId: 8 };
    };
    users.applyTransactionToBalances = async () => {
      if (fail)
        throw Object.assign(new Error("Insufficient available tokens"), {
          status: 400,
        });
      return { senderBalance: 40, receiverBalance: null };
    };
    tokens.TokenTransaction.deleteOne = async (filter) => {
      deleted = filter;
    };
    const body = {
      type: "PENALTY",
      senderId: 2,
      amount: 10,
      reason: " Late cancellation ",
      balanceApplied: true,
    };
    const res = {
      status(code) {
        this.code = code;
        return this;
      },
      json(data) {
        this.body = data;
      },
    };
    await controller.createTokenTran({ body }, res);
    assert.equal(res.code, 201);
    assert.equal(payload.reason, "Late cancellation");
    assert.equal(payload.senderId, 2);
    assert.equal(payload.receiverId, undefined);
    assert.equal(payload.balanceApplied, undefined);
    assert.equal(res.body.receiverBalance, null);
    for (const invalid of [
      { receiverId: 3 },
      { senderId: 0 },
      { amount: -1 },
      { amount: 1.5 },
      { reason: " " },
      { visitId: "3" },
    ]) {
      await controller.createTokenTran({ body: { ...body, ...invalid } }, res);
      assert.equal(res.code, 400);
    }
    fail = true;
    await controller.createTokenTran({ body }, res);
    assert.equal(res.code, 400);
    assert.deepEqual(deleted, { _id: "penalty" });
  } finally {
    [
      tokens.createTransaction,
      users.applyTransactionToBalances,
      tokens.TokenTransaction.deleteOne,
    ] = originals;
  }
});

test("penalty model accepts optional visit context and rejects receivers or invalid senders", async () => {
  for (const invalid of [
    { senderId: null },
    { senderId: -1 },
    { receiverId: 3 },
    { receiverId: 0 },
    { requestId: -1 },
    { amount: 1.5 },
    { reason: " " },
  ]) {
    await assert.rejects(
      tokens.createTransaction({
        type: "PENALTY",
        senderId: 2,
        amount: 10,
        reason: "No-show",
        ...invalid,
      }),
      { status: 400 },
    );
  }
  const Counter = require("../models/counterModel");
  const originals = [tokens.TokenTransaction.create, Counter.getNextSequence];
  try {
    tokens.TokenTransaction.create = async (data) => ({
      ...data,
      save: async () => {},
    });
    Counter.getNextSequence = async () => 9;
    const txn = await tokens.createTransaction({
      type: "PENALTY",
      senderId: 2,
      amount: 10,
      reason: "No-show",
    });
    assert.equal(txn.transactionId, 9);
    assert.equal(txn.receiverId, undefined);
    assert.equal(txn.balanceApplied, false);
  } finally {
    [tokens.TokenTransaction.create, Counter.getNextSequence] = originals;
  }
});

test("penalty balance application protects frozen funds and resets a failed debit", async () => {
  const originals = [
    tokens.TokenTransaction.findOneAndUpdate,
    tokens.TokenTransaction.updateOne,
    users.User.updateOne,
    users.User.findOne,
  ];
  let modifiedCount = 1;
  let reset;
  let writes = 0;
  try {
    tokens.TokenTransaction.findOneAndUpdate = async () => ({
      _id: "penalty",
      type: "PENALTY",
      senderId: 2,
      receiverId: null,
      amount: 10,
    });
    tokens.TokenTransaction.updateOne = async (_, update) => {
      reset = update;
    };
    users.User.findOne = () => ({ select: async () => ({ tokenBalance: 40 }) });
    users.User.updateOne = async (filter, update) => {
      writes++;
      assert.equal(filter.userId, 2);
      assert.deepEqual(filter.$expr.$gte, [
        {
          $subtract: [
            "$tokenBalance",
            { $sum: { $ifNull: ["$tokenReservations.amount", []] } },
          ],
        },
        10,
      ]);
      assert.deepEqual(update, { $inc: { tokenBalance: -10 } });
      return { modifiedCount };
    };
    const result = await users.applyTransactionToBalances(9);
    assert.equal(result.senderBalance, 40);
    assert.equal(result.receiverBalance, null);
    assert.equal(writes, 1);
    modifiedCount = 0;
    await assert.rejects(users.applyTransactionToBalances(9), { status: 400 });
    assert.deepEqual(reset, { balanceApplied: false });
  } finally {
    [
      tokens.TokenTransaction.findOneAndUpdate,
      tokens.TokenTransaction.updateOne,
      users.User.updateOne,
      users.User.findOne,
    ] = originals;
  }
});
