const mongoose = require('mongoose');

const requestItemSchema = new mongoose.Schema({
  requestItemId: { 
    type: mongoose.Schema.Types.ObjectId, 
    auto: true, 
    alias: '_id' 
  },
  visitId: { type: mongoose.Schema.Types.ObjectId, ref: 'CareVisit', required: true },
  plantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plant', required: true },
  Action: { type: String, default: 'Watering' },
  status: { type: String, default: 'Pending' },
  originalDueAt: { type: Date },
  dueAt: { type: Date },
  adjustmentType: { type: String },
  adjustmentReason: { type: String },
  weatherCheckedAt: { type: Date }
});

module.exports = mongoose.model('RequestItem', requestItemSchema);