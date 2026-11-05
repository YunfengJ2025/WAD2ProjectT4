const CareRequest = require("../models/careRequestModel");
const CareVisit = require("../models/careVisitModel");
const RequestItem = require("../models/requestItemModel");
const PhotoProof = require("../models/photoProofModel");
const { Plant } = require("../models/plantModel");
const { User, releaseTokens } = require("../models/userModel");
const { runHealthChecks } = require("../services/plantHealth");
const { getRequestSteps } = require("../utils/careSteps"); // Care checklist (Carolyn)
const {
  notifyUser,
  burnSitterPenalty,
  singaporeDayBounds,
  singaporeDateLabel,
} = require("../services/visitPolicyService");

// Create an error carrying the HTTP status expected by the response handler.
const fail = (status, message) => Object.assign(new Error(message), { status });
const { dateInSingapore } = require("../utils/calendarDate");

// Convert controller errors into consistent client responses.
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
async function enrichVisits(visits, includeOwnerAddress = false) {
  if (!visits.length) return [];
  const requestIds = [...new Set(visits.map((visit) => visit.requestId))];
  const visitIds = visits.map((visit) => visit.visitId);
  const [requests, items, proofs, makeups] = await Promise.all([
    CareRequest.find({ requestId: { $in: requestIds } }).lean(),
    RequestItem.find({ visitId: { $in: visitIds } }).lean(),
    PhotoProof.find({ visitId: { $in: visitIds } }).lean(),
    CareRequest.find({
      makeupForVisitId: { $in: visitIds },
      status: { $in: ["funding", "open", "in_progress", "completed"] },
    })
      .select("requestId makeupForVisitId")
      .lean(),
  ]);
  const plantIds = [...new Set(items.map((item) => item.plantId))];
  const ownerIds = [...new Set(requests.map((request) => request.ownerId))];
  const [plants, owners] = await Promise.all([
    Plant.find({ plantId: { $in: plantIds } })
      // Care checklist (Carolyn): wateringInfo.notes so the sitter sees the same steps the server checks
      .select("plantId plantName photoUrl plantLocation wateringInfo.notes")
      .lean(),
    User.find({ userId: { $in: ownerIds } })
      // Include the public profile photo for the shared UserAvatar component.
      .select("userId userName photoUrl block unitNumber postalCode")
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
    const owner = request ? ownerById.get(request.ownerId) || null : null;
    return {
      ...visit,
      request: request ? { ...request, healthCheck: undefined } : null, // sitters must not see this
      items: detailedItems,
      plants: visitPlants,
      plant: visitPlants[0] || null,
      // Reveal the full address only on the signed-in sitter's own visit lists.
      owner: owner && !includeOwnerAddress
        ? { userId: owner.userId, userName: owner.userName, photoUrl: owner.photoUrl, block: owner.block, postalCode: owner.postalCode }
        : owner,
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
      status: "missed",
    }).lean();
    if (!visit) throw fail(404, "Missed visit not found");
    const sourceRequest = await CareRequest.findOne({
      requestId: visit.requestId,
      ownerId: req.userId,
    }).lean();
    if (!sourceRequest) throw fail(404, "Care request not found");
    if (sourceRequest.status === "cancelled")
      throw fail(409, "A cancelled request cannot be made up");
    // A cancelled make-up frees this visit for another replacement request.
    if (await CareRequest.exists({
      makeupForVisitId: visitId,
      status: { $in: ["funding", "open", "in_progress", "completed"] },
    }))
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

// List open visits from active requests, excluding the signed-in owner's own requests.
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

// Claim an open visit for the signed-in sitter and update its request state.
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

// Validate today's per-plant care, upload proofs, complete the visit, and update watering dates.
exports.addVisitProof = async (req, res) => {
  const uploadedPhotos = [];
  let visitDoc;
  const proofDocs = [];
  let itemDocs = [];
  let originalItemStates = [];
  let plantDocs = [];
  let originalPlantWateredDates = [];
  let completionCommitted = false;
  try {
    const visitId = Number(req.params.visitId);
    visitDoc = await CareVisit.findOne({ visitId, sitterId: req.userId, status: "accepted" });
    if (!visitDoc) throw fail(404, "Accepted visit not found");
    // Require proof to be submitted during this visit's scheduled Singapore day.
    const scheduledWindow = singaporeDayBounds(visitDoc.visitDate);
    const submissionStartedAt = new Date();
    if (submissionStartedAt < scheduledWindow.dayStart)
      throw fail(409, "This visit can only be completed on its scheduled date");
    if (submissionStartedAt > scheduledWindow.dayEnd)
      throw fail(409, "The visit period has ended and can no longer be submitted");
    const request = await CareRequest.findOne({ requestId: visitDoc.requestId, status: "in_progress" });
    if (!request) throw fail(404, "Active care request not found");
    itemDocs = await RequestItem.find({ visitId: visitDoc.visitId });
    if (!itemDocs.length) throw fail(404, "Visit plant items not found");
    // Care checklist (Carolyn): completedSteps added so a failed upload puts it back too
    originalItemStates = itemDocs.map((item) => ({ action: item.action, status: item.status, dueAt: item.dueAt, completedSteps: item.completedSteps }));
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

    // Care checklist (Carolyn): every care step must be ticked before the visit counts.
    // completedSteps is sent as JSON, e.g. { "5": ["Water the soil", "Wipe the leaves"] }
    let completedSteps;
    try {
      completedSteps = JSON.parse(req.body.completedSteps || "{}");
    } catch {
      throw fail(400, "Care checklist was not submitted correctly");
    }
    if (!completedSteps || typeof completedSteps !== "object" || Array.isArray(completedSteps))
      throw fail(400, "Care checklist was not submitted correctly");
    const checklistPlants = await Plant.find({ plantId: { $in: itemDocs.map((item) => item.plantId) } })
      .select("plantId plantName wateringInfo.notes")
      .lean();
    const checklistPlantById = new Map(checklistPlants.map((plant) => [plant.plantId, plant]));
    const tickedByPlant = new Map();
    for (const item of itemDocs) {
      const plant = checklistPlantById.get(item.plantId);
      const steps = getRequestSteps(item, plant);
      const ticked = Array.isArray(completedSteps[item.plantId]) ? completedSteps[item.plantId].map(String) : [];
      if (steps.some((step) => !ticked.includes(step)))
        throw fail(400, `Tick every care step for ${plant?.plantName || `plant #${item.plantId}`} first`);
      tickedByPlant.set(item.plantId, steps); // save only the real steps
    }
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
      item.completedSteps = tickedByPlant.get(item.plantId) || []; // Care checklist (Carolyn)
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

    const completionTime = new Date();
    if (completionTime < scheduledWindow.dayStart)
      throw fail(409, "This visit can only be completed on its scheduled date");
    if (completionTime > scheduledWindow.dayEnd)
      throw fail(409, "The visit period ended before proof could be saved");
    // Complete only if the scheduled visit is still accepted; the sweeper may have expired it.
    visitDoc = await CareVisit.findOneAndUpdate(
      { visitId: visitDoc.visitId, sitterId: req.userId, status: "accepted" },
      { $set: { status: "completed", doneAt: visitDate } },
      { new: true },
    );
    if (!visitDoc) throw fail(409, "The visit is no longer available to complete");
    completionCommitted = true;
    // The plant schedule uses lastWateredAt plus frequencyDays for its next due date.
    plantDocs = await Plant.find({ plantId: { $in: itemDocs.map((item) => item.plantId) } });
    originalPlantWateredDates = plantDocs.map((plant) => plant.lastWateredAt);
    const wateringUpdates = await Promise.allSettled(plantDocs.map(async (plant) => {
      plant.lastWateredAt = visitDate;
      await plant.save();
    }));
    const failedWateringUpdate = wateringUpdates.find((result) => result.status === "rejected");
    if (failedWateringUpdate) throw failedWateringUpdate.reason;
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
      item.completedSteps = original.completedSteps; // Care checklist (Carolyn)
      await item.save();
    }));
    // Restore plant schedules if any part of visit completion fails.
    await Promise.allSettled(plantDocs.map(async (plant, index) => {
      plant.lastWateredAt = originalPlantWateredDates[index];
      await plant.save();
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

// Return the signed-in sitter's visit history with request and plant details.
exports.myVisits = async (req, res) => {
  try {
    const visits = await CareVisit.find({ sitterId: req.userId }).sort({ visitDate: -1 }).lean();
    res.json({ visits: await enrichVisits(visits, true) });
  } catch (err) {
    handleError(err, res);
  }
};

// Return only visits currently accepted by the signed-in sitter.
exports.myAssignments = async (req, res) => {
  try {
    const visits = await CareVisit.find({ sitterId: req.userId, status: "accepted" })
      .sort({ visitDate: 1 })
      .lean();
    res.json({ visits: await enrichVisits(visits, true) });
  } catch (err) {
    handleError(err, res);
  }
};

exports.enrichVisits = enrichVisits;

// Owners and assigned sitters can inspect their visits. Other users can only
// inspect open opportunities belonging to an active request.
exports.getVisitDetail = async (req, res) => {
  try {
    const visitId = Number(req.params.visitId);
    if (!Number.isSafeInteger(visitId) || visitId < 1) {
      throw fail(404, "Visit not found");
    }
    const visit = await CareVisit.findOne({ visitId }).lean();
    if (!visit) {
      throw fail(404, "Visit not found");
    }
    const [detail] = await enrichVisits([visit]);
    const participant = detail.request?.ownerId === req.userId || visit.sitterId === req.userId;
    const available = visit.status === "open" &&
      ["open", "in_progress"].includes(detail.request?.status);
    if (!participant && !available) {
      throw fail(404, "Visit not found");
    }
    // Include the owner's full address only for a visit participant.
    if (participant && detail.owner) {
      const ownerAddress = await User.findOne({ userId: detail.owner.userId })
        .select("userId userName photoUrl block unitNumber postalCode -_id")
        .lean();
      if (ownerAddress) detail.owner = { ...detail.owner, ...ownerAddress };
    }
    // Only public profile fields are needed to identify the sitter.
    detail.sitter = await User.findOne({ userId: visit.sitterId })
      .select("userId userName photoUrl -_id")
      .lean();
    const { Review } = require("../models/reviewModel");
    // Calculate both participants' ratings from all received care reviews,
    // matching the public profile's rating range and published-review filter.
    const participants = [detail.owner, detail.sitter].filter(Boolean);
    const ratingSummaries = await Review.aggregate([
      {
        $match: {
          receiverId: { $in: participants.map((user) => user.userId) },
          type: "VISIT",
          reviewId: { $ne: null },
          rating: { $gte: 1, $lte: 5 },
        },
      },
      {
        $group: {
          _id: "$receiverId",
          averageRating: { $avg: "$rating" },
          reviewCount: { $sum: 1 },
        },
      },
    ]);
    for (const user of participants) {
      const summary = ratingSummaries.find((item) => item._id === user.userId);
      user.averageRating = summary?.averageRating ?? null;
      user.reviewCount = summary?.reviewCount ?? 0;
    }
    const reviews = await Review.find({ visitId, type: "VISIT", reviewId: { $ne: null } })
      .select("reviewId creatorId receiverId rating comment createdAt -_id")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ visit: detail, reviews });
  } catch (err) {
    handleError(err, res);
  }
};

// Use the signed-in identity and derive the receiver on the server. A care
// review uses the existing VISIT type so it also appears under My reviews.
exports.reviewVisit = async (req, res) => {
  try {
    const visitId = Number(req.params.visitId);
    if (!Number.isSafeInteger(visitId) || visitId < 1) {
      throw fail(404, "Visit not found");
    }
    const visit = await CareVisit.findOne({ visitId, status: "completed" }).lean();
    if (!visit) {
      throw fail(404, "Completed visit not found");
    }
    const request = await CareRequest.findOne({ requestId: visit.requestId }).lean();
    let receiverId;
    if (request && request.ownerId === req.userId) {
      receiverId = visit.sitterId;
    } else if (request && visit.sitterId === req.userId) {
      receiverId = request.ownerId;
    } else {
      throw fail(403, "Only the owner and sitter can review this visit");
    }
    if (!receiverId) {
      throw fail(409, "The other participant is unavailable");
    }
    const { rating, comment } = req.body;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw fail(400, "Choose a rating between 1 and 5");
    }
    if (typeof comment !== "string" || !comment.trim() || comment.trim().length > 1000) {
      throw fail(400, "Write a review between 1 and 1000 characters");
    }
    const reviewModel = require("../models/reviewModel");
    if (await reviewModel.Review.exists({ visitId, creatorId: req.userId })) {
      throw fail(409, "You have already reviewed this visit");
    }
    const review = await reviewModel.createReview({
      type: "VISIT",
      visitId,
      creatorId: req.userId,
      receiverId,
      rating,
      comment: comment.trim(),
    });
    res.status(201).json({ review });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "You have already reviewed this visit" });
    }
    handleError(err, res);
  }
};
