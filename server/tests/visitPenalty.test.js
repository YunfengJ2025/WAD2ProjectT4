const { test } = require('node:test');
const assert = require('node:assert/strict');
const users = require('../models/userModel');
const tokens = require('../models/tokenModel');
const { burnSitterPenalty } = require('../services/visitPolicyService');

test('visit policy uses the token backend exactly once and caps the debit at available funds', async () => {
  const originals = [users.User.findOne, tokens.createTransaction, users.applyTransactionToBalances, tokens.TokenTransaction.deleteOne];
  let balance = 50;
  let failure = false;
  const calls = [];
  try {
    users.User.findOne = () => ({ select: () => ({ lean: async () => ({ tokenBalance: balance, tokenReservations: [{ requestId: 99, amount: 45 }] }) }) });
    tokens.createTransaction = async (data) => {
      calls.push(['create', data]);
      return { _id: 'penalty', transactionId: 7 };
    };
    users.applyTransactionToBalances = async (id) => {
      calls.push(['apply', id]);
      if (failure) throw new Error('Debit failed');
    };
    tokens.TokenTransaction.deleteOne = async (filter) => { calls.push(['delete', filter]); };
    const input = { sitterId: 2, visitId: 3, requestId: 4, requestedAmount: 10 };
    assert.equal(await burnSitterPenalty(input), 5);
    assert.equal(calls.length, 2);
    assert.equal(calls[0][1].amount, 5);
    assert.equal(calls[0][1].type, 'PENALTY');
    assert.equal(calls[0][1].senderId, 2);
    assert.equal(calls[0][1].receiverId, null);
    assert.equal(calls[0][1].balanceApplied, undefined);
    assert.deepEqual(calls[1], ['apply', 7]);

    calls.length = 0;
    balance = 45;
    assert.equal(await burnSitterPenalty(input), 0);
    assert.equal(calls.length, 0);

    balance = 50;
    failure = true;
    await assert.rejects(burnSitterPenalty(input), /Debit failed/);
    assert.deepEqual(calls.at(-1), ['delete', { _id: 'penalty' }]);
  } finally {
    [users.User.findOne, tokens.createTransaction, users.applyTransactionToBalances, tokens.TokenTransaction.deleteOne] = originals;
  }
});
