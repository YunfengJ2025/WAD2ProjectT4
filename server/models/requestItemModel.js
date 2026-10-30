const mongoose = require("mongoose");
const { getNextSequence } = require("./counterModel");

const requestItemSchema = new mongoose.Schema({
  requestItemId: { type: Number, unique: true, sparse: true, immutable: true },
  visitId: { type: Number, required: true, immutable: true },
  plantId: { type: Number, required: true, immutable: true },
  action: { type: String, required: true, trim: true, maxlength: 100 },
  status: { type: String, enum: ["pending", "accepted", "completed", "cancelled"], default: "pending" },
  originalDueAt: { type: Date, required: true },
  dueAt: { type: Date, required: true },
  adjustmentType: { type: String, default: "none" },
  adjustmentReason: { type: String, default: "" },
  weatherCheckedAt: { type: Date, default: null },
});

requestItemSchema.pre("save", async function () {
  if (this.isNew && this.requestItemId == null) this.requestItemId = await getNextSequence("requestItemId");
});

module.exports = mongoose.model("RequestItem", requestItemSchema, "RequestItem");
git 