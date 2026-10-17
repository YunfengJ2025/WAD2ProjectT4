const mongoose = require('mongoose');

const photoProofSchema = new mongoose.Schema(
  {
      photoProofId: { 
        type: String, 
        required: true, 
        unique: true 
      },
      requestItemId: { 
        type: String, 
        required: true 
      },
      visitId: { 
        type: String, 
        required: true 
      },
      photoUrl: { 
        type: String, 
        required: true 
      },
      takenAt: { 
        type: Date, 
        default: Date.now 
      }
  }, 
  { 
    timestamps: true 
  });

module.exports = mongoose.models.PhotoProof || mongoose.model('PhotoProof', photoProofSchema);