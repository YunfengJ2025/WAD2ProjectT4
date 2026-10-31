const mongoose = require("mongoose");
const { getNextSequence } = require("./counterModel");

const photoProofSchema = new mongoose.Schema({
  photoProofId: { type: Number, unique: true, sparse: true, immutable: true },
  requestItemId: { type: Number, required: true, immutable: true },
  visitId: { type: Number, required: true, immutable: true },
  photoUrl: { type: String, required: true },
  photoPublicId: { type: String, default: "" },
  takenAt: { type: Date, required: true, default: Date.now },
});

photoProofSchema.pre("save", async function () {
  if (this.isNew && this.photoProofId == null) this.photoProofId = await getNextSequence("photoProofId");
});

module.exports = mongoose.model("PhotoProof", photoProofSchema, "PhotoProof");
