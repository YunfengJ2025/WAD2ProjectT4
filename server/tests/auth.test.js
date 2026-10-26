const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "test-secret-that-is-at-least-32-bytes-long";
const { createAccessToken, verifyAccessToken, validateJwtConfig } = require("../config/jwt");
const users = require("../models/userModel");
const tokens = require("../models/tokenModel");
const user = { _id: "user-db-id", userId: 1, userName: "testuser", email: "test@example.com", userRole: "user", tokenBalance: 50 };
const admin = { ...user, userId: 2, userRole: "admin" };

// Exercise the real HTTP routes and JWT middleware without requiring MongoDB.
users.User.findOne = async ({ userId }) => userId === 1 ? user : userId === 2 ? admin : null;
users.loginUser = async (email, password) => {
  if (email !== user.email || password !== "password123") {
    throw Object.assign(new Error("Invalid email or password"), { status: 401 });
  }
  return user;
};
users.registerUser = async () => ({ ...user, passwordHash: "never-expose-this" });
users.getAllUsers = async () => [user, admin];
users.applyTransactionToBalances = async () => ({ receiverBalance: 50 });
tokens.createTransaction = async () => ({ transactionId: 1 });

test("JWT user endpoints", async (t) => {
  const app = express();
  app.use(express.json());
  app.use("/user", require("../routes/userRoute"));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, token, method = "GET", body) => fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  await t.test("login and registration return a safe user and expiring JWT", async () => {
    for (const path of ["login", "register"]) {
      const response = await request(`/user/${path}`, null, "POST", { userName: user.userName, email: user.email, password: "password123" });
      assert.equal(response.status, path === "register" ? 201 : 200);
      const body = await response.json();
      assert.equal(body.tokenType, "Bearer");
      assert.equal(body.expiresIn, 3600);
      assert.equal(body.user.passwordHash, undefined);
      const claims = verifyAccessToken(body.accessToken);
      assert.equal(claims.sub, "1");
      assert.equal(claims.exp - claims.iat, 3600);
    }
  });
  await t.test("missing fields and incorrect credentials are rejected", async () => {
    assert.equal((await request("/user/login", null, "POST", {})).status, 400);
    assert.equal((await request("/user/register", null, "POST", {})).status, 400);
    assert.equal((await request("/user/login", null, "POST", { email: user.email, password: "wrong" })).status, 401);
  });
  await t.test("me resolves the current user from a valid Bearer token", async () => {
    const response = await request("/user/me", createAccessToken(user));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).user.userId, 1);
  });
  await t.test("missing, malformed, forged, expired and deleted-user tokens are rejected", async () => {
    const claims = { subject: "1", issuer: "plantpal-api", audience: "plantpal-client" };
    const invalid = [
      null,
      "malformed",
      jwt.sign({}, "wrong-secret", { ...claims, expiresIn: "1h" }),
      jwt.sign({}, process.env.JWT_SECRET, { ...claims, expiresIn: -1 }),
      jwt.sign({}, process.env.JWT_SECRET, { ...claims, audience: "wrong-client" }),
      jwt.sign({}, process.env.JWT_SECRET, { ...claims, algorithm: "HS384" }),
      jwt.sign({}, process.env.JWT_SECRET, { ...claims, subject: "invalid" }),
      createAccessToken({ userId: 999 }),
    ];
    for (const token of invalid) assert.equal((await request("/user/me", token)).status, 401);
  });
  await t.test("user list and balance updates require an admin", async () => {
    for (const [path, method] of [["/user", "GET"], ["/user/token-balance/1", "PATCH"]]) {
      assert.equal((await request(path, null, method)).status, 401);
      assert.equal((await request(path, createAccessToken(user), method)).status, 403);
      assert.equal((await request(path, createAccessToken(admin), method)).status, 200);
    }
  });
  await t.test("logout completes without a session", async () => {
    assert.equal((await request("/user/logout", null, "POST")).status, 204);
  });
  await t.test("missing or weak signing secrets fail configuration validation", () => {
    const secret = process.env.JWT_SECRET;
    try {
      delete process.env.JWT_SECRET;
      assert.throws(validateJwtConfig, /JWT_SECRET/);
      process.env.JWT_SECRET = "weak";
      assert.throws(validateJwtConfig, /JWT_SECRET/);
    } finally {
      process.env.JWT_SECRET = secret;
    }
  });
});
