const mongoose = require('mongoose');

const photoProofSchema = new mongoose.Schema({
  photoProofId: { 
    type: mongoose.Schema.Types.ObjectId, 
    auto: true, 
    alias: '_id' 
  },
  requestItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'RequestItem', required: true },
  visitId: { type: mongoose.Schema.Types.ObjectId, ref: 'CareVisit', required: true },
  photoUrl: { type: String, required: true },
  takenAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PhotoProof', photoProofSchema);