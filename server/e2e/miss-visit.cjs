// Test-only CLI, never mounted as an HTTP route. Backdate one test visit, then run real policy code.
const mongoose = require("mongoose");
const CareVisit = require("../models/careVisitModel");
const { sweepVisits } = require("../services/visitSweeper");

async function main() {
  const url = process.env.E2E_DB_URL || "";
  if (
    process.env.E2E_LIVE !== "1" ||
    !/^mongodb:\/\/(127\.0\.0\.1|localhost):\d+\/wad2_care_e2e$/.test(url)
  )
    throw new Error(
      "Requires E2E_LIVE=1 and E2E_DB_URL pointing to the local wad2_care_e2e database",
    );
  const visitId = Number(process.argv[2]);
  const ownerId = Number(process.argv[3]);
  if (!Number.isSafeInteger(visitId) || !Number.isSafeInteger(ownerId))
    throw new Error("Invalid test IDs");
  await mongoose.connect(url);
  const CareRequest = require("../models/careRequestModel");
  const { User } = require("../models/userModel");
  const owner = await User.findOne({ userId: ownerId });
  if (
    !owner?.email?.startsWith("e2e-owner-") ||
    !owner.email.endsWith("@example.com")
  )
    throw new Error("Not an E2E owner");
  const visit = await CareVisit.findOne({ visitId, status: "accepted" });
  if (
    !visit ||
    !(await CareRequest.exists({ requestId: visit.requestId, ownerId }))
  )
    throw new Error("Accepted test visit not found");
  visit.visitDate = new Date(Date.now() - 2 * 86400000);
  await visit.save();
  await sweepVisits();
  if ((await CareVisit.findOne({ visitId })).status !== "missed")
    throw new Error("Sweep did not mark visit missed");
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
