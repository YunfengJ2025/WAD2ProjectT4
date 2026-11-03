// Works out which days a request needs a visit, and which plants are due on each day.
// Same dates the controller already uses: Date objects at midnight Singapore time (dateInSingapore).
// Keep this in step with client/src/composables/schedule/buildRequestPlan.js.

const DAY_MS = 86_400_000;
const SGT_OFFSET_MS = 8 * 60 * 60 * 1000;

const addDays = (date, n) => new Date(date.getTime() + n * DAY_MS);

// Midnight Singapore time on the day this moment falls on
const startOfSgtDay = (moment) =>
  new Date(Math.floor((new Date(moment).getTime() + SGT_OFFSET_MS) / DAY_MS) * DAY_MS - SGT_OFFSET_MS);

// startDate / endDate: Dates at midnight Singapore time, both included.
// Returns [{ date: Date, plantIds }] sorted by date, only for days where something is due.
function planVisits(plants, startDate, endDate) {
  const byDay = new Map(); // day (ms) -> plantIds

  for (const plant of plants) {
    const freq = plant.wateringInfo.frequencyDays;

    // first visit: the day it is next due, but never before the request starts.
    // never watered (or already overdue at the start) means the first visit is the start date.
    let day = startDate;
    if (plant.lastWateredAt) {
      const due = addDays(startOfSgtDay(plant.lastWateredAt), freq);
      if (due > startDate) day = due;
    }

    // then every `freq` days until the end of the period
    while (day <= endDate) {
      byDay.set(day.getTime(), [...(byDay.get(day.getTime()) || []), plant.plantId]);
      day = addDays(day, freq);
    }
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([time, plantIds]) => ({ date: new Date(time), plantIds }));
}

module.exports = { planVisits };