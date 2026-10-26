const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const posts = require('../models/postModel');
const likes = require('../models/likeModel');
const counter = require('../models/counterModel');
const { User } = require('../models/userModel');
const controller = require('../controllers/postController');

function response() {
  return { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}

test('creation uses authenticated creator and ignores client count and ID', async (t) => {
  let input;
  t.mock.method(posts, 'createPost', async (data) => { input = data; return data; });
  const res = response();
  await controller.createPost({ userId: 2, body: { creatorId: 99, postId: 100, likedCount: 50, content: ' Hello ' } }, res);
  assert.equal(res.code, 201);
  assert.deepEqual(input, { creatorId: 2, content: 'Hello', postImage: undefined });
});

test('invalid content is rejected before reaching model', async (t) => {
  t.mock.method(posts, 'createPost', () => assert.fail('must not insert'));
  for (const content of ['', '   ', null, 42]) {
    const res = response();
    await controller.createPost({ userId: 2, body: { content } }, res);
    assert.equal(res.code, 400);
  }
});

test('post inserts before counter allocation, sharing the transaction session', async (t) => {
  const session = {};
  const steps = [];
  t.mock.method(mongoose.connection, 'transaction', async (fn) => fn(session));
  t.mock.method(User, 'exists', () => ({ session: async () => true }));
  const post = { save: async (options) => { assert.equal(options.session, session); steps.push('save'); } };
  t.mock.method(posts.Post, 'create', async (data, options) => {
    assert.equal(options.session, session);
    assert.equal(data[0].likedCount, undefined);
    steps.push('insert'); return [post];
  });
  t.mock.method(counter, 'getNextSequence', async (name, received) => {
    assert.equal(name, 'postId'); assert.equal(received, session);
    steps.push('counter'); return 1;
  });
  assert.equal((await posts.createPost({ creatorId: 2, content: 'Hello' })).postId, 1);
  assert.deepEqual(steps, ['insert', 'counter', 'save']);
});

test('failed insertion never calls the counter', async (t) => {
  t.mock.method(mongoose.connection, 'transaction', async (fn) => fn({}));
  t.mock.method(User, 'exists', () => ({ session: async () => true }));
  t.mock.method(posts.Post, 'create', async () => { throw new Error('insert failed'); });
  t.mock.method(counter, 'getNextSequence', () => assert.fail('counter must not increment'));
  await assert.rejects(posts.createPost({ creatorId: 2 }), /insert failed/);
});

test('likes increment once and unlikes decrement once; repeats leave count unchanged', async (t) => {
  t.mock.method(mongoose.connection, 'transaction', async (fn) => fn({}));
  const post = { likedCount: 0, save: async () => {} };
  t.mock.method(posts.Post, 'findOne', () => ({ session: async () => post }));
  t.mock.method(User, 'exists', () => ({ session: async () => true }));
  let exists = false;
  t.mock.method(likes.Like, 'updateOne', async () => {
    const upsertedCount = exists ? 0 : 1; exists = true; return { upsertedCount };
  });
  t.mock.method(likes.Like, 'deleteOne', async () => {
    const deletedCount = exists ? 1 : 0; exists = false; return { deletedCount };
  });
  for (const [liked, count] of [[true, 1], [true, 1], [false, 0], [false, 0]]) {
    assert.equal((await likes.setLiked(1, 2, liked)).likedCount, count);
  }
});

test('schemas default count to zero and enforce a unique creator/post pair', () => {
  assert.equal(new posts.Post({ creatorId: 2, content: 'Hello' }).likedCount, 0);
  assert.ok(likes.Like.schema.indexes().some(([keys, options]) => keys.creatorId === 1 && keys.postId === 1 && options.unique));
});
