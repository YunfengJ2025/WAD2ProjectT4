const { test } = require("node:test");
const assert = require("node:assert/strict");
const tokens = require("../models/tokenModel");
const users = require("../models/userModel");
const controller = require("../controllers/tokenController");

test("token route skips user login for gifts but requires it for care", async () => {
  const router = require("../routes/tokenRoute");
  const authorize = router.stack.find((layer) => layer.route?.methods.post).route.stack[0].handle;
  let continued = false;
  await authorize({ body: { type: "SYSTEM_GIFT" } }, {}, () => { continued = true; });
  assert.equal(continued, true);
  const res = { status(code) { this.code = code; return this; }, json() {} };
  await authorize({ body: { type: "CARE" }, get: () => undefined }, res, () => {});
  assert.equal(res.code, 401);
});

test("system gift creation without authentication, validation and failed-credit cleanup", async (t) => {
  const originals = [
    tokens.createTransaction,
    users.applyTransactionToBalances,
    tokens.TokenTransaction.deleteOne,
  ];
  let created;
  let deleted;
  let failCredit;
  t.after(() => {
    [
      tokens.createTransaction,
      users.applyTransactionToBalances,
      tokens.TokenTransaction.deleteOne,
    ] = originals;
  });
  tokens.createTransaction = async (data) => {
    created = data;
    return { _id: "gift", transactionId: 9 };
  };
  users.applyTransactionToBalances = async (id) => {
    assert.equal(id, 9);
    if (failCredit)
      throw Object.assign(new Error("Receiver not found"), { status: 404 });
    return { receiverBalance: 75 };
  };
  tokens.TokenTransaction.deleteOne = async (filter) => {
    deleted = filter;
  };
  const gift = {
    type: "SYSTEM_GIFT",
    receiverId: 2,
    amount: 25,
    reason: " Event reward ",
  };
  async function send(body) {
    created = undefined;
    deleted = undefined;
    const res = {
      status(code) {
        this.code = code;
        return this;
      },
      json(body) {
        this.body = body;
      },
    };
    // No user, Authorization header, API key, or header getter is supplied.
    await controller.createTokenTran({ body }, res);
    return res;
  }
  await t.test(
    "gifts can be created without login details or an API key",
    async () => {
      const res = await send(gift);
      assert.equal(res.code, 201);
      assert.deepEqual(created, {
        type: "SYSTEM_GIFT",
        receiverId: 2,
        amount: 25,
        reason: "Event reward",
      });
      assert.equal(res.body.receiverBalance, 75);
    },
  );
  await t.test(
    "invalid gifts and unknown types are rejected before insertion",
    async () => {
      for (const body of [
        undefined,
        { ...gift, type: "SHOP_PURCHASE" },
        { ...gift, amount: 0 },
        { ...gift, amount: 1.5 },
        { ...gift, receiverId: -1 },
        { ...gift, receiverId: "2" },
        { ...gift, reason: " " },
        { ...gift, senderId: 1 },
        { ...gift, visitId: 1 },
        { ...gift, requestId: 1 },
      ]) {
        assert.equal((await send(body)).code, 400);
        assert.equal(created, undefined);
      }
    },
  );
  await t.test("failed credits remove the transaction record", async () => {
    failCredit = true;
    assert.equal((await send(gift)).code, 404);
    assert.deepEqual(deleted, { _id: "gift" });
  });
});
