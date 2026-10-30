const mongoose = require("mongoose");
const { getNextSequence } = require("./counterModel");

const careVisitSchema = new mongoose.Schema(
  {
    visitId: { type: Number, unique: true, sparse: true, immutable: true },
    sitterId: { type: Number, default: null },
    requestId: { type: Number, required: true, immutable: true },
    visitDate: { type: Date, required: true, default: Date.now },
    status: { type: String, enum: ["open", "accepted", "completed", "cancelled"], default: "open" },
    doneAt: { type: Date, default: null },
  },
  { timestamps: false },
);

careVisitSchema.pre("save", async function () {
  if (this.isNew && this.visitId == null) this.visitId = await getNextSequence("visitId");
});

module.exports = mongoose.model("CareVisit", careVisitSchema, "CareVisit");
