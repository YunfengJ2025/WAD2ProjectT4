const mongoose = require('mongoose');

const careVisitSchema = new mongoose.Schema(
  {
    visitId: { 
      type: String, 
      required: true, 
      unique: true 
    },
    sitterId: { 
      type: Number, 
      default: null 
    }, 
    requestId: { 
      type: String, 
      required: true 
    },
    visitDate: { 
      type: Date, 
      required: true 
    },
    status: { type: String, 
      enum: ['Pending', 'Accepted', 'In Progress', 'Completed'], 
      default: 'Pending' },
      doneAt: { type: Date, default: null  

    }
  }, 
  { 
    timestamps: true 
  });

module.exports = mongoose.models.CareVisit || mongoose.model('CareVisit', careVisitSchema);