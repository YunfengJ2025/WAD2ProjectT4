const test = require("node:test");
const assert = require("node:assert/strict");
const { planVisits } = require("../services/visitPlan");

// same kind of dates the controller builds: midnight Singapore time
const day = (iso) => new Date(`${iso}T00:00:00+08:00`);
const watered = (iso) => new Date(`${iso}T12:00:00+08:00`);
const plant = (plantId, frequencyDays, lastWateredAt = null) => ({ plantId, lastWateredAt, wateringInfo: { frequencyDays } });
// plan with the dates turned back into "YYYY-MM-DD" so the checks are easy to read
const run = (plants, start, end) =>
  planVisits(plants, day(start), day(end)).map(({ date, plantIds }) => ({
    date: new Date(date.getTime() + 8 * 3600e3).toISOString().slice(0, 10),
    plantIds,
  }));

test("a plant watered every 3 days is due every 3rd day, starting from its next due date", () => {
  const plan = run([plant(1, 3, watered("2026-11-02"))], "2026-11-03", "2026-11-12");
  assert.deepEqual(plan.map((d) => d.date), ["2026-11-05", "2026-11-08", "2026-11-11"]);
});

test("a never-watered or overdue plant gets its first visit on the start date", () => {
  const plan = run([plant(1, 4), plant(2, 2, watered("2026-10-01"))], "2026-11-10", "2026-11-12");
  assert.deepEqual(plan, [
    { date: "2026-11-10", plantIds: [1, 2] },
    { date: "2026-11-12", plantIds: [2] },
  ]);
});

test("plants due on the same day share one visit, and days with nothing due get none", () => {
  const plan = run([plant(1, 2, watered("2026-11-02")), plant(2, 4, watered("2026-11-02"))], "2026-11-02", "2026-11-10");
  assert.deepEqual(plan, [
    { date: "2026-11-04", plantIds: [1] },
    { date: "2026-11-06", plantIds: [1, 2] },
    { date: "2026-11-08", plantIds: [1] },
    { date: "2026-11-10", plantIds: [1, 2] },
  ]);
});

test("a plant that does not need water in the period creates no visits", () => {
  assert.deepEqual(run([plant(1, 14, watered("2026-11-02"))], "2026-11-03", "2026-11-08"), []);
});

test("the end date is included, and a late-night watering counts as that Singapore day", () => {
  const plan = run([plant(1, 1, new Date("2026-11-01T23:30:00+08:00"))], "2026-11-02", "2026-11-03");
  assert.deepEqual(plan.map((d) => d.date), ["2026-11-02", "2026-11-03"]);
});