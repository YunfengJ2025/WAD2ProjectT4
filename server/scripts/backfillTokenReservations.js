// Stop request/visit writes while applying this one-time migration.
// Preview: node scripts/backfillTokenReservations.js
// Apply:   node scripts/backfillTokenReservations.js --apply
require("dotenv").config();
const mongoose = require("mongoose");
const CareRequest = require("../models/careRequestModel");
const CareVisit = require("../models/careVisitModel");
const { TokenTransaction } = require("../models/tokenModel");
const { User, reserveTokens, tokenSummary } = require("../models/userModel");

async function main() {
  await mongoose.connect(process.env.DB);
  const apply = process.argv.includes("--apply");
  const requests = await CareRequest.find().sort({ requestId: 1 }).lean();
  // Track planned reservations during preview too, so multiple requests from one
  // owner cannot each assume the same available tokens are still unused.
  const availableByOwner = new Map();
  let blocked = false;
  for (const request of requests) {
    const owner = await User.findOne({ userId: request.ownerId });
    if (!owner) continue;
    // Skip requests already migrated or created by the reservation-aware controller.
    if (
      owner.tokenReservations.some(
        (item) => item.requestId === request.requestId,
      )
    )
      continue;
    const visits = await CareVisit.find({
      requestId: request.requestId,
      status: { $in: ["open", "accepted", "completed"] },
    }).lean();
    const paid = await TokenTransaction.distinct("visitId", {
      type: "CARE",
      balanceApplied: true,
      visitId: { $in: visits.map((visit) => visit.visitId) },
    });
    // Do not freeze rewards already paid. Cancelled requests may still owe rewards
    // for completed visits, but their uncompleted visits no longer need funding.
    const unpaid = visits.filter(
      (visit) =>
        !paid.includes(visit.visitId) &&
        (request.status !== "cancelled" || visit.status === "completed"),
    );
    const amount = unpaid.length * request.tokenReward;
    if (!amount) continue;
    const available =
      availableByOwner.get(owner.userId) ??
      tokenSummary(owner).availableTokenBalance;
    // Report underfunded legacy requests for manual resolution instead of freezing
    // more than the owner owns. Other affordable requests can still be processed.
    if (available < amount) {
      console.error(
        `Request #${request.requestId}: needs ${amount} tokens; owner #${owner.userId} has ${available} available. Resolve funding or cancel this request.`,
      );
      blocked = true;
      continue;
    }
    if (apply) await reserveTokens(owner.userId, request.requestId, amount);
    availableByOwner.set(owner.userId, available - amount);
    console.log(
      `${apply ? "Reserved" : "Would reserve"} ${amount} tokens for request #${request.requestId}`,
    );
  }
  if (blocked) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
