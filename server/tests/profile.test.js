const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const cloud = require("../config/cloudinary");

let uploads = [];
let deletions = [];
cloud.uploadImage = async (buffer, folder) => {
  uploads.push({ buffer, folder });
  return { url: "https://images.example/new-avatar.png", publicId: "new-avatar" };
};
cloud.deleteImage = async (id) => { if (id) deletions.push(id); };
// Fake OneMap: 000000 doesn't exist, 999999 means OneMap is down, anything else is Blk 640.
const onemap = require("../utils/onemap");
let lookups = [];
onemap.lookupPostal = async (postalCode) => {
  lookups.push(postalCode);
  if (postalCode === "000000") return null;
  if (postalCode === "999999") throw Object.assign(new Error("Could not reach OneMap"), { status: 503 });
  return { postalCode, block: "640", road: "ROWELL ROAD", lat: 1.3, lng: 103.8 };
};
const { User, toAuthJSON } = require("../models/userModel");
const { createAccessToken } = require("../config/jwt");
process.env.JWT_SECRET = "profile-test-secret-with-at-least-32-bytes";
let current;
let failSave;
User.findOne = async () => current;
User.findById = () => ({ select: async () => ({ photoPublicId: "old-avatar" }) });

test("profile details and avatar uploads", async (t) => {
  const app = express();
  app.use(express.json());
  app.use("/user", require("../routes/userRoute"));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  t.beforeEach(() => {
    uploads = [];
    deletions = [];
    lookups = [];
    failSave = false;
    // hydrate = a user loaded from the database, so unchanged fields are not "modified"
    current = User.hydrate({ userId: 1, userName: "Gardener", email: "garden@example.com",
      passwordHash: "secret-hash", postalCode: "123456", block: "123A", unitNumber: "#05-12",
      photoUrl: "https://images.example/old.png", photoPublicId: "old-avatar", tokenBalance: 50 });
    current.save = async () => {
      if (failSave) throw new Error("Database unavailable");
      return current;
    };
  });
  const endpoint = `http://127.0.0.1:${server.address().port}/user/me`;
  const token = createAccessToken({ userId: 1 });
  function patch(body, authorized = true) {
    const multipart = body instanceof FormData;
    return fetch(endpoint, { method: "PATCH", body: multipart ? body : JSON.stringify(body),
      headers: { ...(authorized ? { Authorization: `Bearer ${token}` } : {}),
        ...(multipart ? {} : { "Content-Type": "application/json" }) } });
  }
  function photoForm(type = "image/png", size = 20) {
    const form = new FormData();
    form.append("photo", new Blob([Buffer.alloc(size)], { type }), "avatar.png");
    return form;
  }

  await t.test("rejects unauthenticated updates before uploading", async () => {
    assert.equal((await patch(photoForm(), false)).status, 401);
    assert.equal(uploads.length, 0);
  });
  await t.test("updates only whitelisted details and retains the existing avatar", async () => {
    const response = await patch({ userName: " New name ", postalCode: "654321", userRole: "admin", tokenBalance: 999, photoUrl: "fake" });
    assert.equal(response.status, 200);
    const { user } = await response.json();
    assert.equal(user.userName, "New name");
    assert.equal(user.postalCode, "654321");
    assert.equal(user.userRole, "user");
    assert.equal(user.tokenBalance, 50);
    assert.equal(user.photoUrl, "https://images.example/old.png");
    assert.equal(user.photoPublicId, undefined);
    assert.equal(user.passwordHash, undefined);
    // A new postal code fills in its block from OneMap
    assert.equal(user.block, "640");
    assert.deepEqual(lookups, ["654321"]);
  });
  await t.test("does not ask OneMap when the address is unchanged", async () => {
    const response = await patch({ userName: "Other name", postalCode: "123456" });
    assert.equal(response.status, 200);
    assert.deepEqual(lookups, []);
  });
  await t.test("rejects a postal code that does not exist", async () => {
    const response = await patch({ postalCode: "000000" });
    assert.equal(response.status, 400);
    assert.ok((await response.json()).errors.postalCode);
  });
  await t.test("blocks the save when OneMap is down", async () => {
    const response = await patch({ postalCode: "999999" });
    assert.equal(response.status, 503);
  });
  await t.test("postal check endpoint returns the block or 404", async () => {
    const base = `http://127.0.0.1:${server.address().port}/user/postal/`;
    const found = await fetch(base + "200640");
    assert.equal(found.status, 200);
    assert.deepEqual(await found.json(), { postalCode: "200640", block: "640", road: "ROWELL ROAD" });
    assert.equal((await fetch(base + "000000")).status, 404);
    assert.equal((await fetch(base + "12ab")).status, 400);
  });
  await t.test("uploads avatars to the icon folder and deletes the old image after saving", async () => {
    const response = await patch(photoForm());
    assert.equal(response.status, 200);
    assert.equal((await response.json()).user.photoUrl, "https://images.example/new-avatar.png");
    assert.equal(uploads[0].folder, cloud.FOLDERS.userIcon);
    assert.ok(Buffer.isBuffer(uploads[0].buffer));
    assert.deepEqual(deletions, ["old-avatar"]);
  });
  await t.test("validates details before uploading", async () => {
    const form = photoForm();
    form.append("postalCode", "bad");
    const response = await patch(form);
    assert.equal(response.status, 400);
    assert.ok((await response.json()).errors.postalCode);
    assert.equal(uploads.length, 0);
    assert.deepEqual(deletions, []);
  });
  await t.test("rejects unsupported and oversized files", async () => {
    for (const form of [photoForm("text/plain"), photoForm("image/png", 2 * 1024 * 1024 + 1)]) {
      const response = await patch(form);
      assert.equal(response.status, 400);
      assert.ok((await response.json()).errors.photo);
    }
    assert.equal(uploads.length, 0);
  });
  await t.test("removes the new upload and preserves the old image when saving fails", async () => {
    failSave = true;
    assert.equal((await patch(photoForm())).status, 500);
    assert.deepEqual(deletions, ["new-avatar"]);
  });
  await t.test("rejects non-text profile values", async () => {
    assert.equal((await patch({ userName: { $set: "unexpected" } })).status, 400);
  });
  await t.test("bio is optional, editable, clearable and limited to 500 characters", async () => {
    let response = await patch({ bio: "  Growing herbs  " });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).user.bio, "Growing herbs");
    response = await patch({ bio: "" });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).user.bio, "");
    response = await patch({ bio: "x".repeat(501) });
    assert.equal(response.status, 400);
    assert.ok((await response.json()).errors.bio);
  });
  await t.test("authentication responses expose the photo but exclude its management id", () => {
    const safe = toAuthJSON(current);
    assert.equal(safe.photoUrl, current.photoUrl);
    assert.equal(safe.photoPublicId, undefined);
  });
});
