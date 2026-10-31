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
  await controller.createPost({ userId: 2, body: { creatorId: 99, postId: 100, likedCount: 50, title: 'Title', content: ' Hello ' } }, res);
  assert.equal(res.code, 201);
  assert.deepEqual(input, { creatorId: 2, title: 'Title', content: 'Hello' });
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

const images = require('../config/cloudinary');
const reviews = require('../models/reviewModel');

test('uploads multiple photos in order and removes uploads if post creation fails', async (t) => {
  const removed = [];
  let index = 0;
  t.mock.method(images, 'uploadImage', async (buffer, folder) => {
    assert.equal(folder, images.FOLDERS.postImage);
    index += 1;
    return { url: `https://example.com/${index}.jpg`, publicId: `photo${index}` };
  });
  t.mock.method(images, 'deleteImage', async (id) => removed.push(id));
  t.mock.method(posts, 'createPost', async (data) => {
    assert.deepEqual(data.postImages, ['https://example.com/1.jpg', 'https://example.com/2.jpg']);
    throw Object.assign(new Error('Creation failed'), { status: 503 });
  });
  const res = response();
  await controller.createPost({ userId: 2, body: { title: 'Title', content: 'Hello' }, files: [{ buffer: Buffer.from('1') }, { buffer: Buffer.from('2') }] }, res);
  assert.equal(res.code, 503);
  assert.deepEqual(removed, ['photo1', 'photo2']);
});

test('post review takes creator from session and receiver from the post', async (t) => {
  t.mock.method(posts, 'getPost', async () => ({ postId: 5, creatorId: 7 }));
  t.mock.method(User, 'find', () => ({ select: () => ({ lean: async () => [] }) }));
  let input;
  t.mock.method(reviews, 'createReview', async (data) => { input = data; return { ...data, reviewId: 1 }; });
  const res = response();
  await controller.createPostReview({ userId: 2, params: { postId: '5' }, body: { comment: ' Nice! ', creatorId: 99, receiverId: 99 } }, res);
  assert.equal(res.code, 201);
  assert.deepEqual(input, { type: 'POST', postId: 5, creatorId: 2, receiverId: 7, comment: 'Nice!' });
});

test('post reviews reject missing posts and blank comments', async (t) => {
  t.mock.method(posts, 'getPost', async () => null);
  t.mock.method(reviews, 'createReview', () => assert.fail('must not insert'));
  const missing = response();
  await controller.createPostReview({ userId: 2, params: { postId: '5' }, body: { comment: 'Hello' } }, missing);
  assert.equal(missing.code, 404);
  const blank = response();
  await controller.createPostReview({ userId: 2, params: { postId: '5' }, body: { comment: ' ' } }, blank);
  assert.equal(blank.code, 400);
});

 test('updates use both post and authenticated creator IDs and preserve protected fields', async (t) => {
  let query;
  let update;
  t.mock.method(posts.Post, 'findOneAndUpdate', async (filter, data, options) => {
    query = filter; update = data;
    assert.equal(options.runValidators, true);
    return { postId: 5, ...data.$set };
  });
  await posts.updatePost(5, 2, { title: 'New', content: 'Updated', postImages: [] });
  assert.deepEqual(query, { postId: 5, creatorId: 2 });
  assert.deepEqual(update, { $set: { title: 'New', content: 'Updated', postImages: [] } });
});

test('editing another user post is rejected before any upload or update', async (t) => {
  t.mock.method(posts, 'getPost', async () => ({ postId: 5, creatorId: 7 }));
  t.mock.method(posts, 'updatePost', () => assert.fail('must not update'));
  t.mock.method(images, 'uploadImage', () => assert.fail('must not upload'));
  const res = response();
  await controller.updatePost({ userId: 2, params: { postId: '5' }, body: { title: 'New', content: 'Hello' } }, res);
  assert.equal(res.code, 404);
});

test('edit rejects arbitrary photo URLs and preserves only the existing photos chosen', async (t) => {
  t.mock.method(posts, 'getPost', async () => ({ postId: 5, creatorId: 2, postImages: ['https://example.com/1.jpg', 'https://example.com/2.jpg'] }));
  let input;
  t.mock.method(posts, 'updatePost', async (id, creatorId, data) => { input = data; return data; });
  const bad = response();
  await controller.updatePost({ userId: 2, params: { postId: '5' }, body: { title: 'New', content: 'Hello', retainedImages: '["https://other.com/photo.jpg"]' } }, bad);
  assert.equal(bad.code, 400);
  const good = response();
  await controller.updatePost({ userId: 2, params: { postId: '5' }, body: { title: ' New ', content: ' Hello ', retainedImages: '["https://example.com/2.jpg"]', likedCount: 99 } }, good);
  assert.equal(good.code, 200);
  assert.deepEqual(input, { title: 'New', content: 'Hello', postImages: ['https://example.com/2.jpg'] });
});

test('deleting uses owner filter and removes reviews, replies and likes in the same transaction', async (t) => {
  const session = {};
  t.mock.method(mongoose.connection, 'transaction', async fn => fn(session));
  t.mock.method(posts.Post, 'findOneAndDelete', async (filter, options) => {
    assert.deepEqual(filter, { postId: 5, creatorId: 2 });
    assert.equal(options.session, session);
    return { postId: 5 };
  });
  t.mock.method(reviews.Review, 'find', () => ({ session: async () => [{ reviewId: 8 }] }));
  t.mock.method(reviews.Review, 'deleteMany', async (filter, options) => {
    assert.deepEqual(filter.$or, [{ postId: 5 }, { parentReviewId: { $in: [8] } }]);
    assert.equal(options.session, session);
  });
  t.mock.method(likes.Like, 'deleteMany', async (filter, options) => {
    assert.deepEqual(filter, { postId: 5 }); assert.equal(options.session, session);
  });
  await posts.deletePost(5, 2);
});

test('liked history uses the current creator and preserves newest-like order', async (t) => {
  t.mock.method(likes.Like, 'find', filter => {
    assert.deepEqual(filter, { creatorId: 2 });
    return { sort: order => {
      assert.deepEqual(order, { likedAt: -1, _id: -1 });
      return { lean: async () => [{ postId: 2, likedAt: '2026-10-30' }, { postId: 1, likedAt: '2026-10-29' }, { postId: 99 }] };
    } };
  });
  t.mock.method(posts.Post, 'find', () => ({ lean: async () => [{ postId: 1 }, { postId: 2 }] }));
  const result = await likes.getLikedPosts(2);
  assert.deepEqual(result.map(post => post.postId), [2, 1]);
  assert.equal(result[0].liked, true);
});
