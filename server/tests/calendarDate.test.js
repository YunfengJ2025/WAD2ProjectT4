const { test } = require('node:test');
const assert = require('node:assert/strict');
const { dateInSingapore } = require('../utils/calendarDate');

test('request dates are midnight in Singapore regardless of the host timezone', () => {
  assert.equal(dateInSingapore('2026-11-05').toISOString(), '2026-11-04T16:00:00.000Z');
  assert.equal(dateInSingapore('2027-01-01').toISOString(), '2026-12-31T16:00:00.000Z');
});
