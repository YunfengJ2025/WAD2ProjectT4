const CareRequest = require("../models/careRequestModel");
const CareVisit = require("../models/careVisitModel");
const RequestItem = require("../models/requestItemModel");
const PhotoProof = require("../models/photoProofModel");
const { releaseTokens } = require("../models/userModel");
const {
  notifyUser,
  burnSitterPenalty,
  singaporeDayBounds,
  singaporeDateLabel,
} = require("./visitPolicyService");

async function finishRequestIfNoVisitsRemain(requestId) {
  const hasVisits = await CareVisit.exists({
    requestId,
    status: { $in: ["open", "accepted"] },
  });
  if (!hasVisits) {
    await CareRequest.updateOne(
      { requestId, status: { $in: ["open", "in_progress"] } },
      { $set: { status: "completed" } },
    );
  }
}

async function sweepVisits(now = new Date()) {
  const candidates = await CareVisit.find({
    status: { $in: ["open", "accepted"] },
    visitDate: { $lte: now },
  }).lean();

  for (const candidate of candidates) {
    // Use Singapore's calendar-day deadline for each scheduled visit.
    const { dayEnd } = singaporeDayBounds(candidate.visitDate);
    if (now <= dayEnd) continue;
    const request = await CareRequest.findOne({ requestId: candidate.requestId });
    if (!request || !["open", "in_progress"].includes(request.status)) continue;

    if (candidate.status === "accepted" && candidate.sitterId != null) {
      if (await PhotoProof.exists({ visitId: candidate.visitId })) continue;
      // The conditional state change makes repeated sweeps charge only once.
      const missed = await CareVisit.findOneAndUpdate(
        {
          visitId: candidate.visitId,
          sitterId: candidate.sitterId,
          status: "accepted",
        },
        { $set: { status: "missed", doneAt: now } },
        { new: true },
      );
      if (!missed) continue;

      await RequestItem.updateMany(
        { visitId: candidate.visitId, status: "accepted" },
        { $set: { status: "missed" } },
      );
      const penalty = await burnSitterPenalty({
        sitterId: candidate.sitterId,
        visitId: candidate.visitId,
        requestId: request.requestId,
        requestedAmount: request.tokenReward,
      });
      await releaseTokens(request.ownerId, request.requestId, request.tokenReward);
      const date = singaporeDateLabel(candidate.visitDate);
      await Promise.all([
        notifyUser(
          candidate.sitterId,
          "visit_missed",
          penalty
            ? `You missed the visit scheduled for ${date}. ${penalty} token${penalty === 1 ? "" : "s"} were deducted.`
            : `You missed the visit scheduled for ${date}. No unreserved tokens were available for the penalty.`,
          candidate.visitId,
        ),
        notifyUser(
          request.ownerId,
          "visit_missed",
          `The sitter missed your ${date} visit. ${request.tokenReward} tokens were returned. You can request a make-up visit.`,
          candidate.visitId,
        ),
      ]);
    } else if (candidate.status === "open") {
      // Expire unclaimed slots and return their reserved reward to the owner.
      const expired = await CareVisit.findOneAndUpdate(
        { visitId: candidate.visitId, sitterId: null, status: "open" },
        { $set: { status: "expired", doneAt: now } },
        { new: true },
      );
      if (!expired) continue;
      await RequestItem.updateMany(
        { visitId: candidate.visitId, status: "pending" },
        { $set: { status: "cancelled" } },
      );
      await releaseTokens(request.ownerId, request.requestId, request.tokenReward);
      await notifyUser(
        request.ownerId,
        "visit_expired",
        `No sitter accepted your ${singaporeDateLabel(candidate.visitDate)} visit. ${request.tokenReward} tokens were returned. You can request a make-up visit.`,
        candidate.visitId,
      );
    }

    await finishRequestIfNoVisitsRemain(request.requestId);
  }
}

function startVisitSweeper() {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await sweepVisits();
    } catch (err) {
      console.error("Visit sweep failed:", err);
    } finally {
      running = false;
    }
  };
  // Run once at startup and repeat every 15 minutes without blocking shutdown.
  void run();
  const timer = setInterval(run, 15 * 60 * 1000);
  timer.unref?.();
  return timer;
}

module.exports = { sweepVisits, startVisitSweeper };
