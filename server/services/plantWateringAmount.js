const CareRequest = require("../models/careRequestModel");
const CareVisit = require("../models/careVisitModel");
const RequestItem = require("../models/requestItemModel");
const { notifyUser, singaporeDayBounds, singaporeDateLabel } = require("./visitPolicyService");

// Update upcoming instructions only. Completed items retain the amount used.
async function syncPlantWateringAmount(plant, previousAmount, now = new Date()) {
  const requests = await CareRequest.find({
    ownerId: plant.ownerId,
    status: { $in: ["open", "in_progress"] },
  }).select("requestId").lean();
  if (!requests.length) return;
  const visits = await CareVisit.find({
    requestId: { $in: requests.map((request) => request.requestId) },
    status: { $in: ["open", "accepted"] },
    visitDate: { $gte: singaporeDayBounds(now).dayStart },
  }).lean();
  if (!visits.length) return;
  const items = await RequestItem.find({
    plantId: plant.plantId,
    visitId: { $in: visits.map((visit) => visit.visitId) },
    status: { $in: ["pending", "accepted"] },
  }).lean();
  const visitById = new Map(visits.map((visit) => [visit.visitId, visit]));
  for (const item of items) {
    // Old requests have no flag. Only adopt amounts matching the previous default.
    const followsPlant = item.usePlantAmount ?? (item.amountToWater === previousAmount);
    const amountToWater = followsPlant ? plant.wateringInfo.amountMl : item.amountToWater;
    if (item.usePlantAmount === followsPlant && item.amountToWater === amountToWater) continue;
    const updated = await RequestItem.findOneAndUpdate({
      requestItemId: item.requestItemId,
      status: { $in: ["pending", "accepted"] },
      amountToWater: item.amountToWater,
      usePlantAmount: item.usePlantAmount === undefined ? { $exists: false } : item.usePlantAmount,
    }, { $set: { usePlantAmount: followsPlant, amountToWater } }, { new: true });
    if (!updated || item.amountToWater === amountToWater) continue;
    const visit = visitById.get(item.visitId);
    if (visit.status === "accepted" && visit.sitterId != null) {
      await notifyUser(visit.sitterId, "watering_amount_changed",
        `Watering for ${plant.plantName} on ${singaporeDateLabel(visit.visitDate)} changed from ${item.amountToWater} ml to ${amountToWater} ml. Check the updated visit instructions.`,
        visit.visitId, visit.requestId);
    }
  }
}

module.exports = { syncPlantWateringAmount };
