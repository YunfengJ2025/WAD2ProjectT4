const { test } = require('node:test');
const assert = require('node:assert/strict');
const model = require('../models/reviewModel');
const { User } = require('../models/userModel');
const controller = require('../controllers/reviewController');

test('profile lookup scopes by both participants and includes post thread context', async (t) => {
  const own = [
    { reviewId: 1, type: 'VISIT', creatorId: 2, receiverId: 1, rating: 4 },
    { reviewId: 2, type: 'POST', creatorId: 1, receiverId: 2 },
    { reviewId: 3, type: 'REVIEW', parentReviewId: 5, creatorId: 1, receiverId: 2 },
  ];
  const context = [{ reviewId: 4, type: 'REVIEW', parentReviewId: 2, creatorId: 3, receiverId: 1 }];
  const queries = [];
  t.mock.method(model.Review, 'find', (query) => {
    queries.push(query);
    return { lean: async () => queries.length === 1 ? own : context };
  });
  t.mock.method(User, 'find', () => ({ select: (fields) => {
    assert.equal(fields, 'userId userName photoUrl -_id');
    return { lean: async () => [{ userId: 1, userName: 'Me', photoUrl: 'https://images.example/me.png' }, { userId: 2, userName: 'Alice', photoUrl: 'https://images.example/alice.png' }] };
  } }));
  const result = await model.getProfileReviews(1);
  assert.deepEqual(queries[0].$or, [{ creatorId: 1 }, { receiverId: 1 }]);
  assert.deepEqual(queries[1].$or, [{ parentReviewId: { $in: [2] } }, { reviewId: { $in: [5] } }]);
  assert.equal(result.length, 4);
  assert.equal(result[0].creatorName, 'Alice');
  assert.equal(result[0].creatorPhotoUrl, 'https://images.example/alice.png');
  assert.equal(result[1].creatorPhotoUrl, 'https://images.example/me.png');
  assert.equal(result[3].creatorName, 'User #3');
  assert.equal(result[3].creatorPhotoUrl, '');
});

test('profile controller uses the authenticated user rather than client IDs', async (t) => {
  t.mock.method(model, 'getProfileReviews', async (id) => { assert.equal(id, 1); return []; });
  let body;
  await controller.getMyReviews({ userId: 1, query: { userId: 99 } }, { json: (value) => { body = value; } });
  assert.deepEqual(body, { reviews: [] });
});

test('reply endpoint ignores spoofed creator, receiver and type', async (t) => {
  let input;
  t.mock.method(model, 'createReview', async (data) => { input = data; return { reviewId: 10, ...data }; });
  const res = { status(code) { assert.equal(code, 201); return this; }, json(value) { return value; } };
  await controller.replyAsUser({ userId: 1, body: { parentReviewId: 2, creatorId: 99, receiverId: 99, type: 'VISIT', comment: ' Thanks! ' } }, res);
  assert.deepEqual(input, { type: 'REVIEW', parentReviewId: 2, creatorId: 1, comment: 'Thanks!' });
});

test('care visit reviews and replies cannot receive replies', async (t) => {
  for (const type of ['VISIT', 'REVIEW']) {
    t.mock.method(model.Review, 'findOne', async () => ({ type }));
    await assert.rejects(model.createReview({ type: 'REVIEW', parentReviewId: 1, creatorId: 2, comment: 'Hello' }), { status: 400 });
    t.mock.restoreAll();
  }
});
