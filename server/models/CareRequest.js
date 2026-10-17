const mongoose = require('mongoose');

const careRequestSchema = new mongoose.Schema(
  {
    requestId: { 
      type: String, 
      required: true, 
      unique: true 
    },
    ownerId: { 
      type: Number, 
      required: true 
    }, 
    startDate: { 
      type: Date, 
      required: true 
    },
    endDate: { 
      type: Date, 
      required: true 
    },
    note: { 
      type: String 
    },
    tokenReward: { 
      type: Number, 
      required: true 
    },
    status: { 
      type: String, 
      enum: ['Pending', 'Accepted', 'Completed'], 
      default: 'Pending' 
    }
  }, 
  { 
    timestamps: true 
  });

module.exports = mongoose.models.CareRequest || mongoose.model('CareRequest', careRequestSchema);