const mongoose = require("mongoose");
const { getNextSequence } = require("./counterModel");

const requestItemSchema = new mongoose.Schema({
  requestItemId: { type: Number, unique: true, sparse: true, immutable: true },
  visitId: { type: Number, required: true, immutable: true },
  plantId: { type: Number, required: true, immutable: true },
  action: { type: String, required: true, trim: true, maxlength: 100 },
  amountToWater: { type: Number, min: 0, default: 0 },
  // Undefined on older requests; preserve their custom amounts during migration.
  usePlantAmount: { type: Boolean },
  careInstructions: { type: String, trim: true, maxlength: 500, default: "" },
  // Care checklist (Carolyn): the plant's care steps the sitter ticked during this visit,
  // e.g. ["Water the soil", "Wipe the leaves"]. Steps come from the plant's care notes.
  completedSteps: { type: [{ type: String, trim: true, maxlength: 500 }], default: [] },
  status: {
    type: String,
    // Record that plant items belonged to a visit the sitter missed.
    enum: ["pending", "accepted", "completed", "cancelled", "missed"],
    default: "pending",
  },
  originalDueAt: { type: Date, required: true },
  dueAt: { type: Date, required: true },
  adjustmentType: { type: String, default: "none" },
  adjustmentReason: { type: String, default: "" },
  weatherCheckedAt: { type: Date, default: null },
});

requestItemSchema.pre("save", async function () {
  if (this.isNew && this.requestItemId == null)
    this.requestItemId = await getNextSequence("requestItemId");
});

module.exports = mongoose.model(
  "RequestItem",
  requestItemSchema,
  "RequestItem",
);
