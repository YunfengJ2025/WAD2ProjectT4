const mongoose = require('mongoose');

const plantSchema = new mongoose.Schema(
    {
        plantId: { 
            type: String, 
            required: true, 
            unique: true 
        },
        ownerId: { 
            type: String, 
            required: true 
        },
        plantName: { 
            type: String, 
            required: true 
        },
        photoUrl: { 
            type: String 
        },
        wateringInfo: { 
            type: String 
        },
        sunlight: { 
            type: String, 
            enum: ['full', 'partial', 'shade'], 
            default: 'partial' 
        },
        plantLocation: { 
            type: String, 
            enum: ['balcony', 'corridor'], 
            default: 'balcony' },
        rainExposed: { 
            type: Boolean, 
            default: false 
        },
        weatherAdjustmentEnabled: { 
            type: Boolean, 
            default: true },
        lastWateredAt: { 
            type: Date 
        }
    }, 
    { 
        timestamps: true 
    });

module.exports = mongoose.models.Plant || mongoose.model('Plant', plantSchema);