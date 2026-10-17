const mongoose = require('mongoose');

const requestItemSchema = new mongoose.Schema(
    {
        requestItemId: { 
            type: String, 
            required: true,
            unique: true 
        },
        visitId: { 
            type: String, 
            required: true 
        },
        plantId: { 
            type: String, 
            required: true 
        },
        action: { 
            type: String, 
            default: 'Watering' 
        },
        status: { 
            type: String, 
            enum: ['Pending', 'Completed'], 
            default: 'Pending' 
        },
        originalDueAt: { 
            type: Date 
        },
        dueAt: { 
            type: Date 
        },
        adjustmentType: { 
            type: String 
        },
        adjustmentReason: { 
            type: String 
        },
        weatherCheckedAt: { 
            type: Date 
        }
    }, 
    { 
        timestamps: true 
    });

module.exports = mongoose.models.RequestItem || mongoose.model('RequestItem', requestItemSchema);