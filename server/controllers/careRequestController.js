const CareRequest = require("../models/careRequestModel");
const CareVisit = require("../models/careVisitModel");
const RequestItem = require("../models/requestItemModel");
const { Plant } = require("../models/plantModel");
const { reserveTokens, releaseTokens } = require("../models/userModel");
const { planVisits } = require("../services/visitPlan");
const { enrichVisits } = require("./careVisitController");

const fail = (status, message) => Object.assign(new Error(message), { status });
const dateInSingapore = (value) => new Date(`${value}T00:00:00+08:00`);

function handleError(err, res) {
  if (err.status) return res.status(err.status).json({ message: err.message });
  // A sparse unique link prevents owners from duplicating make-up requests.
  if (err.code === 11000)
    return res.status(409).json({ message: "This record conflicts with an existing record" });
  if (err.name === "ValidationError" || err.name === "CastError") {
    const errors = {};
    for (const [key, detail] of Object.entries(err.errors || {}))
      errors[key] = detail.message;
    return res
      .status(400)
      .json({ message: "Please check the request details", errors });
  }
  console.error(err);
  return res.status(500).json({ message: "Server error" });
}

// Create a request and its visits; shared with the make-up visit endpoint.
async function createCareRequest(ownerId, body, makeupForVisitId) {
  const selectedPlantIds = Array.isArray(body.plantIds)
    ? body.plantIds.map(Number)
    : [Number(body.plantId)];
  const plantIds = [...new Set(selectedPlantIds)];
  if (!plantIds.length || plantIds.some((id) => !Number.isSafeInteger(id) || id < 1))
    throw fail(400, "Choose at least one of your plants");
  const plants = await Plant.find({ ownerId, plantId: { $in: plantIds } });
  if (plants.length !== plantIds.length)
    throw fail(404, "One or more selected plants were not found in your collection");
  const plantDetails = new Map();
  for (const detail of Array.isArray(body.plantDetails) ? body.plantDetails : []) {
    const plantId = Number(detail.plantId);
    if (detail.amountToWater === "" || detail.amountToWater == null)
      throw fail(400, "Enter a watering amount for each selected plant");
    const amountToWater = Number(detail.amountToWater);
    if (!plantIds.includes(plantId)) throw fail(400, "Care details must match selected plants");
    if (!Number.isFinite(amountToWater) || amountToWater < 0 || amountToWater > 10000)
      throw fail(400, "Water amount must be between 0 and 10000 ml per visit");
    plantDetails.set(plantId, {
      amountToWater,
      careInstructions: String(detail.careInstructions || "").trim(),
    });
  }
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const startDate = datePattern.test(body.startDate || "")
    ? dateInSingapore(body.startDate)
    : new Date(NaN);
  const endDate = datePattern.test(body.endDate || "")
    ? dateInSingapore(body.endDate)
    : new Date(NaN);
  if (Number.isNaN(startDate.getTime())) throw fail(400, "Enter a valid start date");
  if (Number.isNaN(endDate.getTime())) throw fail(400, "Enter a valid end date");
  if (endDate < startDate) throw fail(400, "End date must be on or after start date");

  // which days need a visit
  let plan;
  if (makeupForVisitId) {
    // a make-up request is always exactly one visit, for the plants of the visit that was missed
    plan = [{ date: startDate, plantIds }];
  } else {
    if ((endDate - startDate) / 86_400_000 > 90)
      throw fail(400, "A request can cover at most 90 days");
    const todaySgt = dateInSingapore(new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10));
    if (startDate < todaySgt) throw fail(400, "Start date can't be in the past");
    plan = planVisits(plants, startDate, endDate);
    if (!plan.length)
      throw fail(400, "None of the selected plants need watering in this period");
  }

  const request = await CareRequest.create({
    ownerId,
    ...(makeupForVisitId ? { makeupForVisitId } : {}),
    startDate,
    endDate,
    note: body.note || "",
    waterSource: body.waterSource || "tap_available",
    healthCheck: body.healthCheck === true, // owner chooses at posting time
    tokenReward: Number(body.tokenReward),
    status: "funding",
  });
  const createdVisits = [];
  const createdItems = [];
  try {
    // One visit per day that has a plant due, so the reward is reserved per real visit.
    await reserveTokens(ownerId, request.requestId, request.tokenReward * plan.length);
    for (const day of plan) {
      const visitDate = new Date(day.date.getTime() + 12 * 60 * 60 * 1000);
      const visit = await CareVisit.create({ requestId: request.requestId, visitDate, status: "open" });
      createdVisits.push(visit);
      // only the plants that are due that day
      for (const plantId of day.plantIds) {
        const item = await RequestItem.create({
          visitId: visit.visitId,
          plantId,
          action: "Plant care",
          amountToWater: plantDetails.get(plantId)?.amountToWater ?? 0,
          careInstructions: plantDetails.get(plantId)?.careInstructions || "",
          status: "pending",
          originalDueAt: visitDate,
          dueAt: visitDate,
        });
        createdItems.push(item);
      }
    }
    request.status = "open";
    await request.save();
  } catch (err) {
    await Promise.all(createdItems.map((item) => item.deleteOne()));
    await Promise.all(createdVisits.map((visit) => visit.deleteOne()));
    await request.deleteOne();
    await releaseTokens(ownerId, request.requestId);
    throw err;
  }
  return { request: { ...request.toObject(), plants } };
}

exports.create = async (req, res) => {
  try {
    res.status(201).json(await createCareRequest(req.userId, req.body));
  } catch (err) {
    handleError(err, res);
  }
};
exports.createCareRequest = createCareRequest;

exports.mine = async (req, res) => {
  try {
    const requests = await CareRequest.find({ ownerId: req.userId })
      .sort({ createdAt: -1 })
      .lean();
    const visits = await CareVisit.find({
      requestId: { $in: requests.map((r) => r.requestId) },
    })
      .sort({ visitDate: 1 })
      .lean();
    const enriched = await enrichVisits(visits);
    const grouped = new Map();
    for (const visit of enriched)
      grouped.set(visit.requestId, [
        ...(grouped.get(visit.requestId) || []),
        visit,
      ]);
    res.json({
      requests: requests.map((request) => {
        const careVisits = grouped.get(request.requestId) || [];
        const plants = [];
        const plantDetails = new Map();
        for (const visit of careVisits) {
          for (const item of visit.items || []) {
            const plant = item.plant;
            if (!plant) continue;
            if (!plants.some((item) => item.plantId === plant.plantId)) plants.push(plant);
            if (!plantDetails.has(plant.plantId)) plantDetails.set(plant.plantId, {
              ...plant,
              amountToWater: item.amountToWater ?? 0,
              careInstructions: item.careInstructions || "",
            });
          }
        }
        return {
          ...request,
          plants,
          plantDetails: [...plantDetails.values()],
          visits: careVisits,
        };
      }),
    });
  } catch (err) {
    handleError(err, res);
  }
};

exports.cancel = async (req, res) => {
  try {
    const requestId = Number(req.params.requestId);
    const request = await CareRequest.findOne({
      requestId,
      ownerId: req.userId,
      status: { $in: ["open", "in_progress"] },
    });
    if (!request) throw fail(404, "Active request not found");
    const claimed = await CareVisit.exists({
      requestId,
      status: { $in: ["accepted"] },
    });
    if (claimed)
      throw fail(
        409,
        "A sitter has already accepted a visit; cancel after that visit is completed",
      );
    request.status = "cancelled";
    await request.save();
    const cancelled = await CareVisit.updateMany(
      { requestId, status: "open" },
      { $set: { status: "cancelled" } },
    );
    await RequestItem.updateMany(
      {
        visitId: {
          $in: (
            await CareVisit.find({ requestId }).select("visitId").lean()
          ).map((v) => v.visitId),
        },
        status: "pending",
      },
      { $set: { status: "cancelled" } },
    );
    // Release only visits changed from open to cancelled. Completed visits may
    // still await payment, so their rewards must remain reserved.
    await releaseTokens(
      req.userId,
      request.requestId,
      cancelled.modifiedCount * request.tokenReward,
    );
    res.json({ request });
  } catch (err) {
    handleError(err, res);
  }
};

