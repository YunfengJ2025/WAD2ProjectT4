const CareRequest = require("../models/careRequestModel");
const CareVisit = require("../models/careVisitModel");
const RequestItem = require("../models/requestItemModel");
const PhotoProof = require("../models/photoProofModel");
const { Plant } = require("../models/plantModel");
const { User, releaseTokens } = require("../models/userModel");
const { runHealthChecks } = require("../services/plantHealth");
const {
  notifyUser,
  burnSitterPenalty,
  singaporeDayBounds,
  singaporeDateLabel,
} = require("../services/visitPolicyService");

const fail = (status, message) => Object.assign(new Error(message), { status });
const dateInSingapore = (value) => new Date(`${value}T00:00:00+08:00`);

function handleError(err, res) {
  if (err.status) return res.status(err.status).json({ message: err.message });
  if (err.code === 11000)
    return res.status(409).json({ message: "This record conflicts with an existing record" });
  if (err.name === "ValidationError" || err.name === "CastError") {
    const errors = {};
    for (const [key, detail] of Object.entries(err.errors || {}))
      errors[key] = detail.message;
    return res.status(400).json({ message: "Please check the request details", errors });
  }
  console.error(err);
  return res.status(500).json({ message: "Server error" });
}

// Assemble visits with their request, owner, plants, per-plant proofs, and make-up link.
async function enrichVisits(visits) {
  if (!visits.length) return [];
  const requestIds = [...new Set(visits.map((visit) => visit.requestId))];
  const visitIds = visits.map((visit) => visit.visitId);
  const [requests, items, proofs, makeups] = await Promise.all([
    CareRequest.find({ requestId: { $in: requestIds } }).lean(),
    RequestItem.find({ visitId: { $in: visitIds } }).lean(),
    PhotoProof.find({ visitId: { $in: visitIds } }).lean(),
    CareRequest.find({ makeupForVisitId: { $in: visitIds } })
      .select("requestId makeupForVisitId")
      .lean(),
  ]);
  const plantIds = [...new Set(items.map((item) => item.plantId))];
  const ownerIds = [...new Set(requests.map((request) => request.ownerId))];
  const [plants, owners] = await Promise.all([
    Plant.find({ plantId: { $in: plantIds } })
      .select("plantId plantName photoUrl plantLocation")
      .lean(),
    User.find({ userId: { $in: ownerIds } })
      .select("userId userName block postalCode")
      .lean(),
  ]);
  const requestById = new Map(requests.map((request) => [request.requestId, request]));
  const itemsByVisit = new Map();
  for (const item of items) {
    itemsByVisit.set(item.visitId, [...(itemsByVisit.get(item.visitId) || []), item]);
  }
  const proofsByItem = new Map(proofs.map((proof) => [proof.requestItemId, proof]));
  const plantById = new Map(plants.map((plant) => [plant.plantId, plant]));
  const ownerById = new Map(owners.map((owner) => [owner.userId, owner]));
  const makeupByVisitId = new Map(makeups.map((request) => [request.makeupForVisitId, request.requestId]));

  return visits.map((visit) => {
    const request = requestById.get(visit.requestId) || null;
    const visitItems = itemsByVisit.get(visit.visitId) || [];
    const detailedItems = visitItems.map((item) => {
      const proof = proofsByItem.get(item.requestItemId) || null;
      return {
        ...item,
        plant: plantById.get(item.plantId) || null,
        proofUrl: proof?.photoUrl || "",
        photoProofId: proof?.photoProofId || null,
      };
    });
    const visitPlants = detailedItems.map((item) => item.plant).filter(Boolean);
    return {
      ...visit,
      request: request ? { ...request, healthCheck: undefined } : null, // sitters must not see this
      items: detailedItems,
      plants: visitPlants,
      plant: visitPlants[0] || null,
      owner: request ? ownerById.get(request.ownerId) || null : null,
      action: detailedItems[0]?.action || "",
      proofUrl: detailedItems.find((item) => item.proofUrl)?.proofUrl || "",
      // Let owners see when a replacement request has already been made.
      makeupRequestId: makeupByVisitId.get(visit.visitId) || null,
    };
  });
}

// Create a replacement request from the missed visit's plants and saved care details.
exports.makeUpRequest = async (req, res) => {
  try {
    const visitId = Number(req.params.visitId);
    const visit = await CareVisit.findOne({
      visitId,
      status: { $in: ["missed", "expired"] },
    }).lean();
    if (!visit) throw fail(404, "Missed or expired visit not found");
    const sourceRequest = await CareRequest.findOne({
      requestId: visit.requestId,
      ownerId: req.userId,
    }).lean();
    if (!sourceRequest) throw fail(404, "Care request not found");
    if (sourceRequest.status === "cancelled")
      throw fail(409, "A cancelled request cannot be made up");
    if (await CareRequest.exists({ makeupForVisitId: visitId }))
      throw fail(409, "A make-up request has already been created for this visit");
    const items = await RequestItem.find({ visitId }).lean();
    if (!items.length) throw fail(404, "Visit plant details not found");
    const date = req.body.startDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || ""))
      throw fail(400, "Choose a valid make-up visit date");
    const selectedDate = dateInSingapore(date);
    const firstAvailableDate = new Date(
      singaporeDayBounds(new Date()).dayStart.getTime() + 24 * 60 * 60 * 1000,
    );
    if (Number.isNaN(selectedDate.getTime()) || selectedDate < firstAvailableDate)
      throw fail(400, "A make-up visit must be scheduled for tomorrow or later");

    // Load lazily to avoid a controller import cycle while sharing request creation.
    const { createCareRequest } = require("./careRequestController");
    const result = await createCareRequest(
      req.userId,
      {
        plantIds: items.map((item) => item.plantId),
        plantDetails: items.map((item) => ({
          plantId: item.plantId,
          amountToWater: item.amountToWater ?? 0,
          careInstructions: item.careInstructions || "",
        })),
        startDate: date,
        endDate: date,
        note: sourceRequest.note,
        waterSource: sourceRequest.waterSource,
        healthCheck: sourceRequest.healthCheck === true,
        tokenReward: sourceRequest.tokenReward,
      },
      visitId,
    );
    res.status(201).json(result);
  } catch (err) {
    handleError(err, res);
  }
};

exports.availableVisits = async (req, res) => {
  try {
    const visits = await CareVisit.find({ sitterId: null, status: "open" })
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
    const candidate = await CareVisit.findOne({ visitId, sitterId: null, status: "open" });
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
    if (!visit) throw fail(409, "This visit was just accepted by another sitter");
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

// Release an accepted visit and apply a capped penalty after the 24-hour cutoff.
exports.optOutVisit = async (req, res) => {
  try {
    const visitId = Number(req.params.visitId);
    if (!Number.isSafeInteger(visitId)) throw fail(404, "Visit not found");
    const candidate = await CareVisit.findOne({
      visitId,
      sitterId: req.userId,
      status: "accepted",
    });
    if (!candidate) throw fail(404, "Accepted visit not found");
    const request = await CareRequest.findOne({ requestId: candidate.requestId });
    if (!request || !["open", "in_progress"].includes(request.status))
      throw fail(404, "Active care request not found");

    const now = new Date();
    const { dayStart, dayEnd } = singaporeDayBounds(candidate.visitDate);
    if (now > dayEnd) throw fail(409, "This visit period has ended; it will be handled as missed");
    const penaltyApplies = now > new Date(dayStart.getTime() - 24 * 60 * 60 * 1000);
    const visit = await CareVisit.findOneAndUpdate(
      { visitId, sitterId: req.userId, status: "accepted" },
      { $set: { sitterId: null, status: "open" } },
      { new: true },
    );
    if (!visit) throw fail(409, "This visit can no longer be opted out of");
    await RequestItem.updateMany({ visitId, status: "accepted" }, { $set: { status: "pending" } });
    const penalty = penaltyApplies
      ? await burnSitterPenalty({
          sitterId: req.userId,
          visitId,
          requestId: request.requestId,
          requestedAmount: request.tokenReward,
        })
      : 0;
    const date = singaporeDateLabel(candidate.visitDate);
    await Promise.all([
      notifyUser(
        req.userId,
        "visit_opted_out",
        !penaltyApplies
          ? `You opted out of the ${date} visit before the penalty cutoff.`
          : penalty
            ? `You opted out of the ${date} visit. ${penalty} token${penalty === 1 ? "" : "s"} were deducted.`
            : "You opted out after the cutoff, but had no available tokens to deduct.",
        visitId,
      ),
      notifyUser(
        request.ownerId,
        "sitter_opted_out",
        `The sitter opted out of your ${date} visit. It is open for another sitter.`,
        visitId,
      ),
    ]);
    res.json({ visit, penalty, penaltyApplies });
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
  let completionCommitted = false;
  try {
    const visitId = Number(req.params.visitId);
    visitDoc = await CareVisit.findOne({ visitId, sitterId: req.userId, status: "accepted" });
    if (!visitDoc) throw fail(404, "Accepted visit not found");
    // Proof is accepted only through the end of the scheduled Singapore day.
    if (new Date() > singaporeDayBounds(visitDoc.visitDate).dayEnd)
      throw fail(409, "The visit period has ended and can no longer be submitted");
    const request = await CareRequest.findOne({ requestId: visitDoc.requestId, status: "in_progress" });
    if (!request) throw fail(404, "Active care request not found");
    itemDocs = await RequestItem.find({ visitId: visitDoc.visitId });
    if (!itemDocs.length) throw fail(404, "Visit plant items not found");
    originalItemStates = itemDocs.map((item) => ({ action: item.action, status: item.status, dueAt: item.dueAt }));
    const filesByPlant = new Map((req.files || []).map((file) => [
      /^photo_\d+$/.test(file.fieldname) ? Number(file.fieldname.slice(6)) : NaN,
      file,
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

    try {
      const weatherRes = await fetch("https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast", {
        signal: AbortSignal.timeout(3000),
      });
      const weatherData = await weatherRes.json();
      const forecasts = weatherData?.data?.items?.[0]?.forecasts || [];
      if (forecasts.some((forecast) => /rain|shower|thunder/i.test(forecast.forecast)))
        visitDoc.weatherAlert = "rain";
      const plants = await Plant.find({ plantId: { $in: itemDocs.map((item) => item.plantId) } });
      if (plants.some((plant) => plant.rainExposed || plant.weatherAdjustmentEnabled || /corridor|balcony|outside|open/i.test(plant.plantLocation || "")))
        visitDoc.corridorCared = true;
    } catch (weatherErr) {
      console.warn("Weather check during visit completion skipped:", weatherErr.message);
    }

    if (new Date() > singaporeDayBounds(visitDoc.visitDate).dayEnd)
      throw fail(409, "The visit period ended before proof could be saved");
    // Complete only if the scheduled visit is still accepted; the sweeper may have expired it.
    visitDoc = await CareVisit.findOneAndUpdate(
      { visitId: visitDoc.visitId, sitterId: req.userId, status: "accepted" },
      { $set: { status: "completed", doneAt: visitDate } },
      { new: true },
    );
    if (!visitDoc) throw fail(409, "The visit is no longer available to complete");
    completionCommitted = true;
    const remaining = await CareVisit.exists({ requestId: request.requestId, status: { $in: ["open", "accepted"] } });
    if (!remaining) {
      request.status = "completed";
      await request.save();
    }
    res.status(201).json({
      visit: {
        ...visitDoc.toObject(),
        items: itemDocs.map((item, index) => ({ ...item.toObject(), proofUrl: proofDocs[index].photoUrl })),
        action: itemDocs[0]?.action || "",
        plants: (await Plant.find({ plantId: { $in: itemDocs.map((item) => item.plantId) } }))
          .map((plant) => ({ plantId: plant.plantId, plantName: plant.plantName, photoUrl: plant.photoUrl, plantLocation: plant.plantLocation })),
        proofs: proofDocs.map((proof) => ({ requestItemId: proof.requestItemId, photoUrl: proof.photoUrl })),
        proofUrl: proofDocs[0]?.photoUrl || "",
      },
    });
    
    if (request.healthCheck) { // plant health check, only when the owner turned it on for this request
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
    if (completionCommitted && visitDoc) {
      await CareVisit.updateOne(
        { visitId: visitDoc.visitId, status: "completed", sitterId: req.userId },
        { $set: { status: "accepted", doneAt: null } },
      ).catch(() => {});
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
    const visits = await CareVisit.find({ sitterId: req.userId }).sort({ visitDate: -1 }).lean();
    res.json({ visits: await enrichVisits(visits) });
  } catch (err) {
    handleError(err, res);
  }
};

exports.myAssignments = async (req, res) => {
  try {
    const visits = await CareVisit.find({ sitterId: req.userId, status: "accepted" })
      .sort({ visitDate: 1 })
      .lean();
    res.json({ visits: await enrichVisits(visits) });
  } catch (err) {
    handleError(err, res);
  }
};

exports.enrichVisits = enrichVisits;
