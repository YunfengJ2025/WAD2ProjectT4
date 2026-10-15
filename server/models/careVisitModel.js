const mongoose = require('mongoose');

const careVisitSchema = new mongoose.Schema({
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'CareRequest', required: true },
  sitterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  visitDate: { type: Date, required: true },
  status: { 
    type: String, 
    enum: ['Pending', 'Accepted', 'In Progress', 'Completed'], 
    default: 'Pending' 
  },
  doneAt: { type: Date, default: null }
});

module.exports = mongoose.model('CareVisit', careVisitSchema);