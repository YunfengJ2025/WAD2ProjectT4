const CareRequest = require("../models/careRequestModel");
const CareVisit = require("../models/careVisitModel");
const RequestItem = require("../models/requestItemModel");
const PhotoProof = require("../models/photoProofModel");
const tokenTransaction = require("../models/tokenModel")
const { Plant } = require("../models/plantModel");
const { User } = require("../models/userModel");

const fail = (status, message) => Object.assign(new Error(message), { status });
const dateInSingapore = (value) => new Date(`${value}T00:00:00+08:00`);

function handleError(err, res) {
  if (err.status) return res.status(err.status).json({ message: err.message });
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

async function enrichVisits(visits) {
  if (!visits.length) return [];
  const requestIds = [...new Set(visits.map((v) => v.requestId))];
  const visitIds = visits.map((v) => v.visitId);
  const [requests, items, proofs] = await Promise.all([
    CareRequest.find({ requestId: { $in: requestIds } }).lean(),
    RequestItem.find({ visitId: { $in: visitIds } }).lean(),
    PhotoProof.find({ visitId: { $in: visitIds } }).lean(),
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
  const requestById = new Map(requests.map((r) => [r.requestId, r]));
  const itemByVisit = new Map(items.map((i) => [i.visitId, i]));
  const proofByVisit = new Map(proofs.map((p) => [p.visitId, p]));
  const plantById = new Map(plants.map((p) => [p.plantId, p]));
  const ownerById = new Map(owners.map((u) => [u.userId, u]));
  return visits.map((visit) => {
    const request = requestById.get(visit.requestId) || null;
    const item = itemByVisit.get(visit.visitId) || null;
    const proof = proofByVisit.get(visit.visitId) || null;
    return {
      ...visit,
      request,
      item,
      plant: item ? plantById.get(item.plantId) || null : null,
      owner: request ? ownerById.get(request.ownerId) || null : null,
      action: item?.action || "",
      proofUrl: proof?.photoUrl || "",
    };
  });
}

exports.create = async (req, res) => {
  try {
    const plantId = Number(req.body.plantId);
    if (!Number.isSafeInteger(plantId) || plantId < 1)
      throw fail(400, "Choose one of your plants");
    const plant = await Plant.findOne({ plantId, ownerId: req.userId });
    if (!plant) throw fail(404, "Plant not found in your collection");
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

    const request = await CareRequest.create({
      ownerId: req.userId,
      startDate,
      endDate,
      note: req.body.note || "",
      tokenReward: Number(req.body.tokenReward),
    });
    const createdVisits = [];
    const createdItems = [];
    try {
      // The date range represents one planned plant-care visit per calendar day.
      for (
        let dueAt = new Date(startDate);
        dueAt <= endDate;
        dueAt = new Date(dueAt.getTime() + 86_400_000)
      ) {
        const visitDate = new Date(dueAt.getTime() + 12 * 60 * 60 * 1000);
        const visit = await CareVisit.create({
          requestId: request.requestId,
          visitDate,
          status: "open",
        });
        createdVisits.push(visit);
        const item = await RequestItem.create({
          visitId: visit.visitId,
          plantId,
          action: "Plant care",
          status: "pending",
          originalDueAt: visitDate,
          dueAt: visitDate,
        });
        createdItems.push(item);
      }
    } catch (err) {
      await Promise.all(createdItems.map((item) => item.deleteOne()));
      await Promise.all(createdVisits.map((visit) => visit.deleteOne()));
      await request.deleteOne();
      throw err;
    }
    res.status(201).json({ request: { ...request.toObject(), plant } });
  } catch (err) {
    handleError(err, res);
  }
};

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
        return {
          ...request,
          plant: careVisits[0]?.plant || null,
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
    await CareVisit.updateMany(
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
    res.json({ request });
  } catch (err) {
    handleError(err, res);
  }
};

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
    await RequestItem.updateOne({ visitId }, { $set: { status: "accepted" } });
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
  let uploaded;
  let visitDoc;
  let proofDoc;
  let itemDoc;
  try {
    const visitId = Number(req.params.visitId);
    visitDoc = await CareVisit.findOne({
      visitId,
      sitterId: req.userId,
      status: "accepted",
    });
    if (!visitDoc) throw fail(404, "Accepted visit not found");
    if (!req.file) throw fail(400, "Upload a proof photo");
    if (!req.body.action?.trim())
      throw fail(400, "Describe the action you completed");
    const request = await CareRequest.findOne({
      requestId: visitDoc.requestId,
      status: "in_progress",
    });
    if (!request) throw fail(404, "Active care request not found");
    const visitDate = new Date();
    const { uploadImage, FOLDERS } = require("../config/cloudinary");
    uploaded = await uploadImage(req.file.buffer, FOLDERS.postImage);
    itemDoc = await RequestItem.findOne({ visitId: visitDoc.visitId });
    if (!itemDoc) throw fail(404, "Visit plant item not found");
    itemDoc.action = req.body.action.trim();
    itemDoc.status = "completed";
    itemDoc.dueAt = visitDate;
    await itemDoc.save();
    proofDoc = await PhotoProof.create({
      requestItemId: itemDoc.requestItemId,
      visitId: visitDoc.visitId,
      photoUrl: uploaded.url,
      photoPublicId: uploaded.publicId,
      takenAt: visitDate,
    });
    visitDoc.status = "completed";
    visitDoc.doneAt = visitDate;
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
        action: itemDoc.action,
        proofUrl: proofDoc.photoUrl,
      },
    });
  } catch (err) {
    if (proofDoc) await proofDoc.deleteOne();
    if (uploaded) {
      const { deleteImage } = require("../config/cloudinary");
      await deleteImage(uploaded.publicId);
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
