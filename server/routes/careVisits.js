const express = require('express');
const router = express.Router();
const CareVisit = require('../models/CareVisit');
const CareRequest = require('../models/CareRequest');
const RequestItem = require('../models/RequestItem');
const PhotoProof = require('../models/PhotoProof');

// 1. ACCEPT VISIT ROUTE (PUT /api/care-visits/:visitId/accept)
router.put('/:visitId/accept', async (req, res) => {
  try {
    const { visitId } = req.params;
    const { sitterId } = req.body;

    const visit = await CareVisit.findOne({ visitId });
    if (!visit) {
      return res.status(404).json({ message: 'Visit not found in database.' });
    }

    visit.sitterId = Number(sitterId) || 2; // Pass numeric sitterId matching User schema
    visit.status = 'Accepted';
    await visit.save();

    res.json({ message: 'Visit date accepted successfully!', visit });
  } catch (err) {
    console.error('Accept visit error:', err);
    res.status(500).json({ message: err.message });
  }
});

// 2. PHOTO CHECK-IN ROUTE (POST /api/care-visits/:visitId/check-in)
router.post('/:visitId/check-in', async (req, res) => {
  try {
    const { visitId } = req.params;
    const { photoUrl } = req.body;

    const items = await RequestItem.find({ visitId });
    const primaryItemId = items.length > 0 ? items[0].requestItemId : 'ITEM_GENERIC';

    // Step A: Save Photo Proof
    const proof = new PhotoProof({
      photoProofId: 'PROOF_' + Date.now(),
      requestItemId: primaryItemId,
      visitId,
      photoUrl
    });
    await proof.save();

    // Step B: Mark current visit and tasks as Completed
    const updatedVisit = await CareVisit.findOneAndUpdate(
      { visitId },
      { status: 'Completed', doneAt: new Date() },
      { new: true }
    );
    await RequestItem.updateMany({ visitId }, { status: 'Completed' });

    // Step C: Auto-update parent request status if all visits are completed
    if (updatedVisit && updatedVisit.requestId) {
      const remainingUncompletedVisits = await CareVisit.find({
        requestId: updatedVisit.requestId,
        status: { $ne: 'Completed' }
      });

      if (remainingUncompletedVisits.length === 0) {
        await CareRequest.findOneAndUpdate(
          { requestId: updatedVisit.requestId },
          { status: 'Completed' }
        );
      }
    }

    res.status(201).json({ message: 'Photo proof submitted and request status updated!', proof });
  } catch (err) {
    console.error('Check-in error:', err);
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;