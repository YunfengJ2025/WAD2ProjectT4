const { test } = require('node:test');
const assert = require('node:assert/strict');
const CareRequest = require('../models/careRequestModel');
const CareVisit = require('../models/careVisitModel');
const RequestItem = require('../models/requestItemModel');
const Notification = require('../models/notificationModel');
const { syncPlantWateringAmount } = require('../services/plantWateringAmount');

test('plant edits update active default amounts, preserve custom/history, and notify accepted sitters', async (t) => {
  const items = [
    { requestItemId: 1, visitId: 1, usePlantAmount: true, amountToWater: 200 },
    { requestItemId: 2, visitId: 2, usePlantAmount: false, amountToWater: 150 },
    { requestItemId: 3, visitId: 2, amountToWater: 200 }, // legacy default
    { requestItemId: 4, visitId: 2, amountToWater: 120 }, // legacy custom
    { requestItemId: 5, visitId: 2, usePlantAmount: true, amountToWater: 200 },
  ];
  const updates = [];
  const notices = [];
  t.mock.method(CareRequest, 'find', (filter) => {
    assert.equal(filter.ownerId, 7);
    assert.deepEqual(filter.status.$in, ['open', 'in_progress']);
    return { select: () => ({ lean: async () => [{ requestId: 8 }] }) };
  });
  t.mock.method(CareVisit, 'find', (filter) => {
    assert.deepEqual(filter.status.$in, ['open', 'accepted']);
    assert.equal(filter.visitDate.$gte.toISOString(), '2026-11-04T16:00:00.000Z');
    return { lean: async () => [
      { visitId: 1, requestId: 8, status: 'open' },
      { visitId: 2, requestId: 8, status: 'accepted', sitterId: 9, visitDate: new Date('2026-11-05') },
    ] };
  });
  t.mock.method(RequestItem, 'find', (filter) => {
    assert.equal(filter.plantId, 11);
    assert.deepEqual(filter.status.$in, ['pending', 'accepted']);
    return { lean: async () => items };
  });
  t.mock.method(RequestItem, 'findOneAndUpdate', async (filter, update) => {
    assert.deepEqual(filter.status.$in, ['pending', 'accepted']);
    // Item 5 completed while the plant edit was running: do not overwrite it or notify.
    if (filter.requestItemId === 5) return null;
    updates.push([filter.requestItemId, update.$set]);
    return update.$set;
  });
  t.mock.method(Notification, 'create', async (notice) => { notices.push(notice); });
  await syncPlantWateringAmount({ plantId: 11, ownerId: 7, plantName: 'Fern', wateringInfo: { amountMl: 300 } },
    200, new Date('2026-11-05T04:00:00Z'));
  assert.deepEqual(updates, [
    [1, { usePlantAmount: true, amountToWater: 300 }],
    [3, { usePlantAmount: true, amountToWater: 300 }],
    [4, { usePlantAmount: false, amountToWater: 120 }],
  ]);
  assert.equal(notices.length, 1);
  assert.equal(notices[0].userId, 9);
  assert.equal(notices[0].requestId, 8);
  assert.match(notices[0].message, /200 ml to 300 ml/);
});

test('request creation resolves linked amounts from the plant and preserves explicit custom amounts', async (t) => {
  const { Plant } = require('../models/plantModel');
  const users = require('../models/userModel');
  const saved = [];
  t.mock.method(Plant, 'find', async () => [
    { plantId: 11, wateringInfo: { frequencyDays: 1, amountMl: 300 } },
    { plantId: 12, wateringInfo: { frequencyDays: 1, amountMl: 250 } },
  ]);
  t.mock.method(CareRequest, 'create', async (data) => ({ ...data, requestId: 8,
    save: async () => {}, toObject() { return { ...this }; } }));
  t.mock.method(CareVisit, 'create', async () => ({ visitId: 1 }));
  t.mock.method(RequestItem, 'create', async (data) => { saved.push(data); return data; });
  t.mock.method(users.User, 'updateOne', async () => ({ modifiedCount: 1 }));
  const { createCareRequest } = require('../controllers/careRequestController');
  const date = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  await createCareRequest(7, { plantIds: [11, 12], plantDetails: [
    { plantId: 11, usePlantAmount: true, amountToWater: 999 },
    { plantId: 12, usePlantAmount: false, amountToWater: 150 },
  ], startDate: date, endDate: date, tokenReward: 1 });
  assert.deepEqual(saved.map(({ amountToWater, usePlantAmount }) => ({ amountToWater, usePlantAmount })), [
    { amountToWater: 300, usePlantAmount: true },
    { amountToWater: 150, usePlantAmount: false },
  ]);
});
