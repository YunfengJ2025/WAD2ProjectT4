// Find Nearby: open care visits around the logged-in user, nearest first.
// It only READS your teammates' collections (CareVisit, CareRequest, RequestItem,
// Plant, User). Accepting a visit is done by their existing route:
//   POST /care-visits/:visitId/accept

const CareRequest = require("../models/careRequestModel");
const CareVisit = require("../models/careVisitModel");
const RequestItem = require("../models/requestItemModel");
const { Plant } = require("../models/plantModel");
const { User } = require("../models/userModel");
const { geocodePostal } = require("../utils/onemap");

const MAX_RADIUS_KM = 1; // from the proposal: "within a short walk, 1 km"

const fail = (status, message) => Object.assign(new Error(message), { status });

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// "YYYY-MM-DD" in Singapore time, so a visit at noon SGT never slips to another day
const sgDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
};
const startOfTodaySg = () => new Date(`${sgDate(Date.now())}T00:00:00+08:00`);

// Teammates' signup never saves coordinates, so look them up with OneMap the
// first time and save them on the user. Every later request reads them from the database.
async function coordinatesOf(user) {
  if (Number.isFinite(user.lat) && Number.isFinite(user.lng)) {
    return { lat: user.lat, lng: user.lng };
  }
  const pos = await geocodePostal(user.postalCode);
  if (pos) await User.updateOne({ userId: user.userId }, { $set: { lat: pos.lat, lng: pos.lng } });
  return pos;
}

exports.findNearby = async (req, res) => {
  try {
    // 1. where the sitter lives
    const origin = await coordinatesOf(req.user);
    if (!origin) {
      throw fail(400, "We couldn't find your postal code on the map. Check it on your profile.");
    }

    // 2. visits nobody has accepted yet, from today onwards (same rule as /care-visits/available)
    const visits = await CareVisit.find({
      sitterId: null,
      status: "open",
      visitDate: { $gte: startOfTodaySg() },
    })
      .sort({ visitDate: 1 })
      .lean();
    if (!visits.length) return res.json({ origin, visits: [] });

    // 3. their requests, skipping the sitter's own requests
    const requests = await CareRequest.find({
      requestId: { $in: [...new Set(visits.map((v) => v.requestId))] },
      ownerId: { $ne: req.userId },
      status: { $in: ["open", "in_progress"] },
    }).lean();
    const requestById = new Map(requests.map((r) => [r.requestId, r]));

    // every visit of those requests (any status), so a card can say "day 2 of 3, 2 still need a sitter"
    const siblings = await CareVisit.find({ requestId: { $in: requests.map((r) => r.requestId) } })
      .sort({ visitDate: 1 })
      .select("visitId requestId status")
      .lean();
    const daysByRequest = new Map();
    for (const day of siblings) {
      daysByRequest.set(day.requestId, [...(daysByRequest.get(day.requestId) || []), day]);
    }

    // 4. plants to care for in each visit
    const visitIds = visits.map((v) => v.visitId);
    const items = await RequestItem.find({ visitId: { $in: visitIds } })
      .sort({ requestItemId: 1 })
      .lean();
    const plants = await Plant.find({ plantId: { $in: [...new Set(items.map((i) => i.plantId))] } })
      .select("plantId plantName photoUrl plantLocation wateringInfo rainExposed")
      .lean();
    const plantById = new Map(plants.map((p) => [p.plantId, p]));
    const itemsByVisit = new Map();
    for (const item of items) {
      itemsByVisit.set(item.visitId, [...(itemsByVisit.get(item.visitId) || []), item]);
    }

    // 5. owners. select() is a whitelist, so unitNumber, email and passwordHash
    //    are never loaded and can never leak to the map.
    const owners = await User.find({ userId: { $in: [...new Set(requests.map((r) => r.ownerId))] } })
      .select("userId userName photoUrl block postalCode lat lng")
      .lean();
    const ownerPos = new Map();
    for (const owner of owners) {
      ownerPos.set(owner.userId, await coordinatesOf(owner)); // one at a time, to stay kind to OneMap
    }
    const ownerById = new Map(owners.map((o) => [o.userId, o]));

    // 6. join, measure the distance, keep what is within a walk, nearest first
    const result = [];
    for (const visit of visits) {
      const request = requestById.get(visit.requestId);
      const owner = request && ownerById.get(request.ownerId);
      const pos = owner && ownerPos.get(owner.userId);
      if (!request || !owner || !pos) continue;

      const distanceKm = haversine(origin.lat, origin.lng, pos.lat, pos.lng);
      if (distanceKm > MAX_RADIUS_KM) continue;

      const visitPlants = (itemsByVisit.get(visit.visitId) || []).map((item) => {
        const plant = plantById.get(item.plantId);
        return {
          plantId: item.plantId,
          plantName: plant?.plantName || "Plant",
          photoUrl: plant?.photoUrl || "",
          plantLocation: plant?.plantLocation || "",
          amountToWater: item.amountToWater ?? 0, // 0 means the owner left it blank
          usualAmountMl: plant?.wateringInfo?.amountMl ?? 0, // the plant's own usual amount
          rainExposed: Boolean(plant?.rainExposed),
          careInstructions: item.careInstructions || "",
          weatherNote: item.adjustmentType && item.adjustmentType !== "none" ? item.adjustmentReason || "" : "",
        };
      });

      const days = daysByRequest.get(visit.requestId) || [];

      result.push({
        visitId: visit.visitId,
        requestId: visit.requestId,
        visitDate: visit.visitDate,
        date: sgDate(visit.visitDate),
        startDate: sgDate(request.startDate),
        endDate: sgDate(request.endDate),
        dayNumber: days.findIndex((d) => d.visitId === visit.visitId) + 1,
        totalDays: days.length,
        daysStillOpen: days.filter((d) => d.status === "open").length,
        tokenReward: request.tokenReward,
        waterSource: request.waterSource,
        note: request.note,
        ownerId: owner.userId, // for the link to the public profile
        ownerName: owner.userName,
        ownerPhotoUrl: owner.photoUrl || "",
        block: owner.block,
        postalCode: owner.postalCode,
        address: `Blk ${owner.block}, Singapore ${owner.postalCode}`, // block level only
        lat: pos.lat,
        lng: pos.lng,
        distanceKm,
        photoUrl: visitPlants.find((p) => p.photoUrl)?.photoUrl || "",
        plants: visitPlants,
      });
    }
    result.sort((a, b) => a.distanceKm - b.distanceKm);

    res.json({ origin, visits: result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};