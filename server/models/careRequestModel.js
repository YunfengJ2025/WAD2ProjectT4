const mongoose = require('mongoose');

const careVisitSchema = new mongoose.Schema({
  visitID: { 
    type: mongoose.Schema.Types.ObjectId, 
    auto: true, 
    alias: '_id'
  },
  sitterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'CareRequest', required: true },
  visitDate: { type: Date, required: true },
  status: { 
    type: String, 
    enum: ['Pending', 'Accepted', 'In Progress', 'Completed'], 
    default: 'Pending' 
  },
  doneAt: { type: Date, default: null }
});

module.exports = mongoose.model('CareVisit', careVisitSchema);