const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { User } = require("../models/userModel");
const { Review } = require("../models/reviewModel");

const person = { userId: 7, userName: "Neighbour", photoUrl: "https://images.example/user.png", bio: "Herb lover", createdAt: "2026-01-01",
  email: "private@example.com", postalCode: "123456", tokenBalance: 999 };
let records = [
  { reviewId: 1, creatorId: 2, receiverId: 7, type: "VISIT", rating: 5, comment: "Wonderful", createdAt: "2026-10-25" },
  { reviewId: 2, creatorId: 2, receiverId: 7, type: "VISIT", rating: 4, comment: "Great", createdAt: "2026-10-24" },
  { reviewId: 3, creatorId: 2, receiverId: 7, type: "POST", rating: 1, comment: "Not a visit" },
  { reviewId: 4, creatorId: 7, receiverId: 2, type: "VISIT", rating: 1, comment: "Written by user" },
];
let filter;
const query = (data) => ({ select() { return this; }, sort() { return this; }, async lean() { return data; } });
User.findOne = ({ userId }) => query(userId === 7 ? person : null);
User.find = () => query([{ userId: 2, userName: "Author", photoUrl: "https://images.example/author.png" }]);
Review.find = (criteria) => {
  filter = criteria;
  return query(records.filter((item) => item.type === criteria.type && item.receiverId === criteria.receiverId));
};

test("public profile HTTP endpoint", async (t) => {
  const app = express();
  app.use("/user", require("../routes/userRoute"));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const endpoint = `http://127.0.0.1:${server.address().port}/user`;
  await t.test("works without login, exposes only public fields and averages received visit reviews", async () => {
    const response = await fetch(`${endpoint}/7/profile`);
    assert.equal(response.status, 200);
    const profile = await response.json();
    assert.deepEqual(Object.keys(profile.user).sort(), ["bio", "createdAt", "photoUrl", "userId", "userName"]);
    assert.equal(profile.averageRating, 4.5);
    assert.equal(profile.reviewCount, 2);
    assert.ok(profile.reviews.every((review) => review.type === "VISIT"));
    assert.equal(profile.reviews[0].creatorPhotoUrl, "https://images.example/author.png");
    assert.deepEqual(filter, { receiverId: 7, type: "VISIT", reviewId: { $ne: null } });
    assert.ok(!JSON.stringify(profile).includes("private@example.com"));
  });
  await t.test("handles invalid and unknown user IDs", async () => {
    assert.equal((await fetch(`${endpoint}/invalid/profile`)).status, 400);
    assert.equal((await fetch(`${endpoint}/999/profile`)).status, 404);
  });
  await t.test("returns no rating for users with no visit reviews", async () => {
    records = [];
    const profile = await (await fetch(`${endpoint}/7/profile`)).json();
    assert.equal(profile.averageRating, null);
    assert.equal(profile.reviewCount, 0);
    assert.deepEqual(profile.reviews, []);
  });
});
