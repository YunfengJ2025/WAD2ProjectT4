const mongoose = require("mongoose");
const { getNextSequence } = require("./counterModel");

const healthCheckSchema = new mongoose.Schema({
  healthCheckId: { type: Number, unique: true, sparse: true, immutable: true },
  requestItemId: { type: Number, required: true, unique: true }, // one check per plant photo
  visitId: { type: Number, required: true },
  plantId: { type: Number, required: true },
  ownerId: { type: Number, required: true },        // the plant's owner, for the dashboard alert
  status: { type: String, enum: ["completed", "failed"], required: true },
  provider: { type: String, default: "mock" },      // "plant.id" or "mock"
  isHealthy: { type: Boolean, default: null },
  healthProbability: { type: Number, default: null },
  issues: [{
    _id: false,
    name: String,
    probability: Number,
    description: String,
    cause: String,
    commonNames: [String],
    treatment: {
      prevention: [String],
      biological: [String],
      chemical: [String],
    },
  }],
  error: { type: String, default: "" },
  ownerSeenAt: { type: Date, default: null },       // set when the owner opens the alert
  createdAt: { type: Date, default: Date.now },
});

healthCheckSchema.pre("save", async function () {
  if (this.isNew && this.healthCheckId == null)
    this.healthCheckId = await getNextSequence("healthCheckId");
});

module.exports = mongoose.model("HealthCheck", healthCheckSchema, "HealthCheck");