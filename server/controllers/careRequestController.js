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
// <<<<<<<<< Temporary merge branch 1
    const visitPlants = detailedItems.map((item) => item.plant).filter(Boolean);
    return {
      ...visit,
      request: request ? { ...request, healthCheck: undefined } : null,   // sitters do not see this
      items: detailedItems,
      plants: visitPlants,
      plant: visitPlants[0] || null,
      owner: request ? ownerById.get(request.ownerId) || null : null,
      action: detailedItems[0]?.action || "",
      proofUrl: detailedItems.find((item) => item.proofUrl)?.proofUrl || "",
    };
// =========
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
// <<<<<<<<< Temporary merge branch 1
    const selectedPlantIds = Array.isArray(req.body.plantIds)
      ? req.body.plantIds.map(Number)
      : [Number(req.body.plantId)];
    const plantIds = [...new Set(selectedPlantIds)];
    if (!plantIds.length || plantIds.some((id) => !Number.isSafeInteger(id) || id < 1))
      throw fail(400, "Choose at least one of your plants");
    const plants = await Plant.find({ ownerId: req.userId, plantId: { $in: plantIds } });
    if (plants.length !== plantIds.length)
      throw fail(404, "One or more selected plants were not found in your collection");
    const plantDetails = new Map();
    for (const detail of Array.isArray(req.body.plantDetails) ? req.body.plantDetails : []) {
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
    const startDate = datePattern.test(req.body.startDate || "")
      ? dateInSingapore(req.body.startDate)
      : new Date(NaN);
    const endDate = datePattern.test(req.body.endDate || "")
      ? dateInSingapore(req.body.endDate)
      : new Date(NaN);
    if (Number.isNaN(startDate.getTime()))
      throw fail(400, "Enter a valid start date");
    if (Number.isNaN(endDate.getTime()))
      throw fail(400, "Enter a valid end date");
    if (endDate < startDate)
      throw fail(400, "End date must be on or after start date");
    
    if ((endDate - startDate) / 86_400_000 > 90) // 90 day cap for the date picking
      throw fail(400, "A request can cover at most 90 days");

    const todaySgt = dateInSingapore(new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10));
    if (startDate < todaySgt) throw fail(400, "Start date can't be in the past");

    const plan = planVisits(plants, startDate, endDate);// only days where a plant is actually due get a visit
    if (!plan.length)
      throw fail(400, "None of the selected plants need watering in this period");

    const request = await CareRequest.create({
      ownerId: req.userId,
      startDate,
      endDate,
      note: req.body.note || "",
      waterSource: req.body.waterSource || "tap_available",
      healthCheck: req.body.healthCheck === true, // added for health check
      tokenReward: Number(req.body.tokenReward),
      status: "funding", // Keep the request unavailable until funding and setup succeed.
    });
    const createdVisits = [];
    const createdItems = [];
    try {
      // One visit per day that has a plant due, so the reward is reserved per real visit.
      await reserveTokens(
        req.userId,
        request.requestId,
        request.tokenReward * plan.length,
      );
      for (const day of plan) {
        const visitDate = new Date(day.date.getTime() + 12 * 60 * 60 * 1000);
        const visit = await CareVisit.create({
          requestId: request.requestId,
          visitDate,
          status: "open",
        });
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
      
      // Publish only after funds are reserved and all daily visits have been created.
      request.status = "open";
      await request.save();
    } catch (err) {
      await Promise.all(createdItems.map((item) => item.deleteOne()));
      await Promise.all(createdVisits.map((visit) => visit.deleteOne()));
      await request.deleteOne();
      // Failed setup must not leave funds frozen for a request that no longer exists.
      await releaseTokens(req.userId, request.requestId);
      throw err;
    }
    res.status(201).json({ request: { ...request.toObject(), plants } });
// =========
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
// <<<<<<<<< Temporary merge branch 1

exports.availableVisits = async (req, res) => {
  try {
    const visits = await CareVisit.find({
      sitterId: null,
      status: "open",
    })
      .sort({ visitDate: 1 })
      .lean();
    const enriched = await enrichVisits(visits);
    res.json({
      visits: enriched.filter(
        (visit) =>
          visit.request?.ownerId !== req.userId &&
          ["open", "in_progress"].includes(visit.request?.status),
      ),
    });
  } catch (err) {
    handleError(err, res);
  }
};

exports.acceptVisit = async (req, res) => {
  try {
    const visitId = Number(req.params.visitId);
    if (!Number.isSafeInteger(visitId)) throw fail(404, "Visit not found");
    const candidate = await CareVisit.findOne({
      visitId,
      sitterId: null,
      status: "open",
    });
    if (!candidate) throw fail(409, "This visit is no longer available");
    const request = await CareRequest.findOne({
      requestId: candidate.requestId,
      ownerId: { $ne: req.userId },
      status: { $in: ["open", "in_progress"] },
    });
    if (!request) throw fail(404, "Request not found");
    const visit = await CareVisit.findOneAndUpdate(
      { visitId, sitterId: null, status: "open" },
      { $set: { sitterId: req.userId, status: "accepted" } },
      { new: true },
    );
    if (!visit)
      throw fail(409, "This visit was just accepted by another sitter");
    await RequestItem.updateMany({ visitId }, { $set: { status: "accepted" } });
    if (request.status === "open") {
      request.status = "in_progress";
      await request.save();
    }
    res.json({ visit });
  } catch (err) {
    handleError(err, res);
  }
};

exports.addVisitProof = async (req, res) => {
  const uploadedPhotos = [];
  let visitDoc;
  const proofDocs = [];
  let itemDocs = [];
  let originalItemStates = [];
  try {
    const visitId = Number(req.params.visitId);
    visitDoc = await CareVisit.findOne({
      visitId,
      sitterId: req.userId,
      status: "accepted",
    });
    if (!visitDoc) throw fail(404, "Accepted visit not found");
    const request = await CareRequest.findOne({
      requestId: visitDoc.requestId,
      status: "in_progress",
    });
    if (!request) throw fail(404, "Active care request not found");
    itemDocs = await RequestItem.find({ visitId: visitDoc.visitId });
    if (!itemDocs.length) throw fail(404, "Visit plant items not found");
    originalItemStates = itemDocs.map((item) => ({
      action: item.action,
      status: item.status,
      dueAt: item.dueAt,
    }));
    const filesByPlant = new Map((req.files || []).map((file) => [
      /^photo_\d+$/.test(file.fieldname) ? Number(file.fieldname.slice(6)) : NaN, file,
    ]));
    let actions;
    try {
      actions = JSON.parse(req.body.actions || "{}");
    } catch {
      throw fail(400, "Care actions were not submitted correctly");
    }
    if (!actions || typeof actions !== "object" || Array.isArray(actions))
      throw fail(400, "Care actions were not submitted correctly");
    for (const item of itemDocs) {
      const action = String(actions[item.plantId] || "").trim();
      if (!action) throw fail(400, `Describe the completed care for plant #${item.plantId}`);
      if (!filesByPlant.has(item.plantId)) throw fail(400, `Upload a proof photo for plant #${item.plantId}`);
    }
    if (filesByPlant.size !== itemDocs.length)
      throw fail(400, "Upload exactly one proof photo for each plant in this visit");
    const visitDate = new Date();
    const { uploadImage, FOLDERS } = require("../config/cloudinary");
    for (const item of itemDocs) {
      const uploaded = await uploadImage(filesByPlant.get(item.plantId).buffer, FOLDERS.postImage);
      uploadedPhotos.push(uploaded);
      const proof = await PhotoProof.create({
        requestItemId: item.requestItemId,
        visitId: visitDoc.visitId,
        photoUrl: uploaded.url,
        photoPublicId: uploaded.publicId,
        takenAt: visitDate,
      });
      proofDocs.push(proof);
      item.action = String(actions[item.plantId]).trim();
      item.status = "completed";
      item.dueAt = visitDate;
      await item.save();
    }
    visitDoc.status = "completed";
    visitDoc.doneAt = visitDate;

    // Check NEA 2-hour weather alert for rain at completion time
    try {
      const weatherRes = await fetch("https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast", {
        signal: AbortSignal.timeout(3000),
      });
      const weatherData = await weatherRes.json();
      const forecasts = weatherData?.data?.items?.[0]?.forecasts || [];
      const isRainingInSG = forecasts.some((f) =>
        /rain|shower|thunder/i.test(f.forecast),
      );
      if (isRainingInSG) {
        visitDoc.weatherAlert = "rain";
      }

      // Check if plant is in corridor / balcony / exposed to rain
      const plants = await Plant.find({ plantId: { $in: itemDocs.map((item) => item.plantId) } });
      if (plants.some((plant) => plant.rainExposed || plant.weatherAdjustmentEnabled || /corridor|balcony|outside|open/i.test(plant.plantLocation || ""))) {
        visitDoc.corridorCared = true;
      }
    } catch (weatherErr) {
      console.warn("Weather check during visit completion skipped:", weatherErr.message);
    }

    await visitDoc.save();
    const remaining = await CareVisit.exists({
      requestId: request.requestId,
      status: { $in: ["open", "accepted"] },
    });
    if (!remaining) {
      request.status = "completed";
      await request.save();
    }
    res.status(201).json({
      visit: {
        ...visitDoc.toObject(),
        items: itemDocs.map((item, index) => ({
          ...item.toObject(),
          proofUrl: proofDocs[index].photoUrl,
        })),
        action: itemDocs[0]?.action || "",
        plants: (await Plant.find({ plantId: { $in: itemDocs.map((item) => item.plantId) } }))
          .map((plant) => ({ plantId: plant.plantId, plantName: plant.plantName, photoUrl: plant.photoUrl, plantLocation: plant.plantLocation })),
        proofs: proofDocs.map((proof) => ({ requestItemId: proof.requestItemId, photoUrl: proof.photoUrl })),
        proofUrl: proofDocs[0]?.photoUrl || "",
      },
    });

    // added for checking plant health
    if (request.healthCheck) {      // was req.body.healthCheck === "true"
      runHealthChecks({
        items: itemDocs,
        filesByPlant,
        ownerId: request.ownerId,
        visitId: visitDoc.visitId,
      }).catch((e) => console.warn("Health checks skipped:", e.message));
    }

  } catch (err) {
    await Promise.allSettled(itemDocs.map(async (item, index) => {
      const original = originalItemStates[index];
      if (!original) return;
      item.action = original.action;
      item.status = original.status;
      item.dueAt = original.dueAt;
      await item.save();
    }));
    if (visitDoc?.status === "completed") {
      visitDoc.status = "accepted";
      visitDoc.doneAt = null;
      await visitDoc.save().catch(() => {});
    }
    await Promise.allSettled(proofDocs.map((proof) => proof.deleteOne()));
    if (uploadedPhotos.length) {
      const { deleteImage } = require("../config/cloudinary");
      await Promise.allSettled(uploadedPhotos.map((photo) => deleteImage(photo.publicId)));
    }
    handleError(err, res);
  }
};

exports.myVisits = async (req, res) => {
  try {
    const visits = await CareVisit.find({ sitterId: req.userId })
      .sort({ visitDate: -1 })
      .lean();
    res.json({ visits: await enrichVisits(visits) });
  } catch (err) {
    handleError(err, res);
  }
};

exports.myAssignments = async (req, res) => {
  try {
    const visits = await CareVisit.find({
      sitterId: req.userId,
      status: "accepted",
    })
      .sort({ visitDate: 1 })
      .lean();
    res.json({ visits: await enrichVisits(visits) });
  } catch (err) {
    handleError(err, res);
  }
};
// =========
// >>>>>>>>> Temporary merge branch 2
