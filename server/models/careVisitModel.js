const mongoose = require("mongoose");
const { getNextSequence } = require("./counterModel");

const careVisitSchema = new mongoose.Schema(
  {
    visitId: { type: Number, unique: true, sparse: true, immutable: true },
    sitterId: { type: Number, default: null },
    requestId: { type: Number, required: true, immutable: true },
    visitDate: { type: Date, required: true, default: Date.now },
    // Missed and expired visits are final states set by the visit sweep.
    status: { type: String, enum: ["open", "accepted", "completed", "cancelled", "missed", "expired"], default: "open" },
    doneAt: { type: Date, default: null },
    weatherAlert: { type: String, default: null },
    corridorCared: { type: Boolean, default: false },
  },
  { timestamps: false },
);

careVisitSchema.pre("save", async function () {
  if (this.isNew && this.visitId == null) this.visitId = await getNextSequence("visitId");
});

module.exports = mongoose.model("CareVisit", careVisitSchema, "CareVisit");
