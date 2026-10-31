const mongoose = require("mongoose");
const { getNextSequence } = require("./counterModel");

const careRequestSchema = new mongoose.Schema(
  {
    requestId: { type: Number, unique: true, sparse: true, immutable: true },
    ownerId: { type: Number, required: true, immutable: true },
    startDate: { type: Date, required: [true, "Start date is required"] },
    endDate: { type: Date, required: [true, "End date is required"] },
    note: {
      type: String,
      trim: true,
      maxlength: [1000, "Note cannot exceed 1000 characters"],
      default: "",
    },
    waterSource: {
      type: String,
      enum: ["left_out", "tap_available", "sitter_brings"],
      default: "tap_available",
    },
    tokenReward: {
      type: Number,
      required: [true, "Reward is required"],
      min: [1, "Reward must be at least 1 token"],
      validate: Number.isSafeInteger,
    },
    // "funding" is the temporary state while the controller reserves tokens and creates visits.
    status: {
      type: String,
      enum: ["funding", "open", "in_progress", "completed", "cancelled"],
      default: "open",
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

careRequestSchema.pre("save", async function () {
  if (this.isNew && this.requestId == null)
    this.requestId = await getNextSequence("requestId");
});

module.exports = mongoose.model(
  "CareRequest",
  careRequestSchema,
  "CareRequest",
);
