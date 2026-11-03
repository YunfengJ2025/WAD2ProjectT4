const CareRequest = require("../models/careRequestModel");
const CareVisit = require("../models/careVisitModel");
const RequestItem = require("../models/requestItemModel");
const { Plant } = require("../models/plantModel");
const { User, releaseTokens } = require("../models/userModel");
const { notifyUser, singaporeDayBounds, singaporeDateLabel } = require("./visitPolicyService");

const FORECAST_URL = "https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast";
const SGT_OFFSET_MS = 8 * 60 * 60 * 1000;

// The rain check only runs in this window of the visit day (Singapore time).
// Later than this, a sitter may already have planned their day, so no new skips are made.
const CHECK_FROM_HOUR = 7;
const CHECK_UNTIL_HOUR = 12;

// ---------- helpers (no database code) ----------

// Same rule as the owner schedule (classifyForecast in the client's useWeather.js).
function isRainText(text) {
  const t = String(text || "").toLowerCase();
  return t.includes("rain") || t.includes("shower") || t.includes("thundery");
}

// Hour of the day (0-23) in Singapore.
const sgtHour = (now = new Date()) => new Date(now.getTime() + SGT_OFFSET_MS).getUTCHours();

// Straight-line distance between two points in km.
function distanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

// forecast: the JSON from the two-hour forecast endpoint.
// Returns { area, text, rain } for the forecast area nearest to the point, or null if it can't be worked out.
function rainNear(forecast, lat, lng) {
  const areas = forecast?.data?.area_metadata;
  const forecasts = forecast?.data?.items?.[0]?.forecasts;
  if (!Array.isArray(areas) || !areas.length || !Array.isArray(forecasts)) return null;

  let nearest = null;
  for (const area of areas) {
    const spot = area.label_location;
    if (!spot) continue;
    const distance = distanceKm(lat, lng, spot.latitude, spot.longitude);
    if (!nearest || distance < nearest.distance) nearest = { name: area.name, distance };
  }
  if (!nearest) return null;

  const match = forecasts.find((item) => item.area === nearest.name);
  if (!match) return null;
  return { area: nearest.name, text: match.forecast, rain: isRainText(match.forecast) };
}

// Returns the forecast JSON, or null if the request fails (callers treat null as "no skip, try again later").
async function fetchForecast() {
  try {
    const res = await fetch(FORECAST_URL, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ---------- morning check ----------

// Decide once per visit, in the morning: if rain is forecast near the owner and every plant on the
// visit is rain-exposed with weather adjustment turned on, flag the visit so it can be skipped.
// getForecast is a parameter only so the tests can pass in a fake forecast.
async function runWeatherChecks(now = new Date(), getForecast = fetchForecast) {
  const hour = sgtHour(now);
  if (hour < CHECK_FROM_HOUR || hour >= CHECK_UNTIL_HOUR) return;

  const { dayStart, dayEnd } = singaporeDayBounds(now);
  const visits = await CareVisit.find({
    status: { $in: ["open", "accepted"] },
    weatherCheckedAt: null,
    visitDate: { $gte: dayStart, $lte: dayEnd },
  }).lean();
  if (!visits.length) return;

  let forecast = null; // fetched once per run, and only if a visit needs it
  let forecastFetched = false;

  for (const visit of visits) {
    const request = await CareRequest.findOne({ requestId: visit.requestId }).lean();
    if (!request || !["open", "in_progress"].includes(request.status)) continue;

    // Eligible only if every plant on the visit opted in, and we know where the owner is.
    const items = await RequestItem.find({ visitId: visit.visitId }).select("plantId").lean();
    const plantIds = [...new Set(items.map((item) => item.plantId))];
    const plants = await Plant.find({ plantId: { $in: plantIds } })
      .select("plantId rainExposed weatherAdjustmentEnabled")
      .lean();
    const owner = await User.findOne({ userId: request.ownerId }).select("lat lng").lean();
    const eligible =
      plantIds.length > 0 &&
      plants.length === plantIds.length &&
      plants.every((plant) => plant.rainExposed === true && plant.weatherAdjustmentEnabled === true) &&
      Number.isFinite(owner?.lat) &&
      Number.isFinite(owner?.lng);

    if (!eligible) {
      // Nothing to decide for this visit, so don't look at it again.
      await CareVisit.updateOne({ visitId: visit.visitId, weatherCheckedAt: null }, { $set: { weatherCheckedAt: now } });
      continue;
    }

    if (!forecastFetched) {
      forecast = await getForecast();
      forecastFetched = true;
    }
    const result = forecast ? rainNear(forecast, owner.lat, owner.lng) : null;
    if (!result) continue; // no answer: leave it unchecked and try again at the next sweep

    // The conditional update makes the decision final, even if two sweeps overlap.
    const claimed = await CareVisit.findOneAndUpdate(
      { visitId: visit.visitId, status: { $in: ["open", "accepted"] }, weatherCheckedAt: null },
      { $set: { weatherCheckedAt: now, weatherSkip: result.rain } },
      { new: true },
    );
    if (!claimed || !result.rain) continue;

    const date = singaporeDateLabel(visit.visitDate);
    await RequestItem.updateMany(
      { visitId: visit.visitId },
      {
        $set: {
          adjustmentType: "skipped-rain",
          adjustmentReason: `Rain forecast near ${result.area}, so this visit can be skipped without penalty.`,
          weatherCheckedAt: now,
        },
      },
    );
    const notices = [
      notifyUser(
        request.ownerId,
        "weather_skip",
        `Rain is forecast near ${result.area} for your ${date} visit. If it is not done, the visit will be skipped and ${request.tokenReward} tokens returned.`,
        visit.visitId,
      ),
    ];
    if (claimed.sitterId != null)
      notices.push(
        notifyUser(
          claimed.sitterId,
          "weather_skip",
          `Rain is forecast near ${result.area} for the ${date} visit. You may skip it without penalty, or water and submit proof as usual.`,
          visit.visitId,
        ),
      );
    await Promise.all(notices);
  }
}

// ---------- end of day ----------

// Nobody submitted proof: close the flagged visit with no penalty and return the reward.
async function settleWeatherSkip(visit, request, now = new Date()) {
  // Only one of "sitter completes" and "sweep settles" can win this conditional update.
  const skipped = await CareVisit.findOneAndUpdate(
    { visitId: visit.visitId, status: { $in: ["open", "accepted"] }, weatherSkip: true },
    { $set: { status: "weather_skipped", doneAt: now } },
    { new: true },
  );
  if (!skipped) return;

  await RequestItem.updateMany(
    { visitId: visit.visitId, status: { $in: ["pending", "accepted"] } },
    { $set: { status: "cancelled" } },
  );
  await releaseTokens(request.ownerId, request.requestId, request.tokenReward);

  const date = singaporeDateLabel(visit.visitDate);
  const notices = [
    notifyUser(
      request.ownerId,
      "visit_weather_skipped",
      `Your ${date} visit was skipped because of rain. ${request.tokenReward} tokens were returned.`,
      visit.visitId,
    ),
  ];
  if (visit.sitterId != null)
    notices.push(
      notifyUser(
        visit.sitterId,
        "visit_weather_skipped",
        `The ${date} visit was skipped because of rain. No penalty was applied.`,
        visit.visitId,
      ),
    );
  await Promise.all(notices);
}

module.exports = { runWeatherChecks, settleWeatherSkip, isRainText, sgtHour, rainNear };