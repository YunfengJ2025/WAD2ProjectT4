const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { uploadPhoto, uploadPlantPhotos } = require('../middleware/uploadPhoto');
const uploadPostPhotos = require('../middleware/uploadPostPhotos');

test('shared photo validation preserves single, per-plant and post upload contracts', async (t) => {
  const app = express();
  app.post('/single', uploadPhoto, (req, res) => res.json({ field: req.file.fieldname }));
  app.post('/proof', uploadPlantPhotos, (req, res) => res.json({ fields: req.files.map(file => file.fieldname) }));
  app.post('/post', uploadPostPhotos, (req, res) => res.json({ count: req.files.length }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function send(path, fields, type = 'image/png', bytes = 1) {
    const form = new FormData();
    for (const field of fields) form.append(field, new Blob([new Uint8Array(bytes)], { type }), 'proof.png');
    const response = await fetch(base + path, { method: 'POST', body: form });
    return { status: response.status, body: await response.json() };
  }

  await t.test('accepts the field names used by all three forms', async () => {
    assert.deepEqual(await send('/single', ['photo']), { status: 200, body: { field: 'photo' } });
    assert.deepEqual(await send('/proof', ['photo_10', 'photo_20']), { status: 200, body: { fields: ['photo_10', 'photo_20'] } });
    assert.deepEqual(await send('/post', ['photos', 'photos']), { status: 200, body: { count: 2 } });
  });
  await t.test('retains field-specific invalid-type error responses', async () => {
    const single = await send('/single', ['photo'], 'text/plain');
    assert.equal(single.status, 400);
    assert.equal(single.body.errors.photo, 'Photo must be a JPG, PNG or WebP image');
    const proof = await send('/proof', ['photo_10'], 'text/plain');
    assert.equal(proof.status, 400);
    assert.equal(proof.body.errors.photos, 'Photo must be a JPG, PNG or WebP image');
    const post = await send('/post', ['photos'], 'text/plain');
    assert.equal(post.status, 400);
    assert.equal(post.body.message, 'Photos must be JPG, PNG or WebP images');
  });
  await t.test('keeps the 2MB limit and the nine-photo post limit', async () => {
    const single = await send('/single', ['photo'], 'image/png', 2 * 1024 * 1024 + 1);
    assert.equal(single.status, 400);
    assert.equal(single.body.errors.photo, 'Photo must be 2MB or smaller');
    const post = await send('/post', Array(10).fill('photos'));
    assert.equal(post.status, 400);
    assert.equal(post.body.message, 'Upload up to 9 photos using the photos field');
  });
});
