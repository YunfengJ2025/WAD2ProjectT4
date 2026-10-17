const express = require('express');
const router = express.Router();
const CareVisit = require('../models/CareVisit');
const RequestItem = require('../models/RequestItem');
const PhotoProof = require('../models/PhotoProof');

// Sitter accepts an individual visit date
router.put('/:visitId/accept', async (req, res) => {
  try {
    const visit = await CareVisit.findOne({ visitId: req.params.visitId });
    if (!visit) return res.status(404).json({ message: 'Visit not found' });

    visit.sitterId = req.body.sitterId || 'sitter_user_456';
    visit.status = 'Accepted';
    await visit.save();

    res.json({ message: 'Visit accepted successfully', visit });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Sitter completes photo check-in
router.post('/:visitId/check-in', async (req, res) => {
  try {
    const { visitId } = req.params;
    const { photoUrl } = req.body;

    const items = await RequestItem.find({ visitId });
    const primaryItemId = items.length > 0 ? items[0].requestItemId : 'ITEM_GENERIC';

    const proof = new PhotoProof({
      photoProofId: 'PROOF_' + Date.now(),
      requestItemId: primaryItemId,
      visitId,
      photoUrl
    });
    await proof.save();

    // Mark visit and associated items completed
    await CareVisit.findOneAndUpdate({ visitId }, { status: 'Completed', doneAt: new Date() });
    await RequestItem.updateMany({ visitId }, { status: 'Completed' });

    res.status(201).json({ message: 'Photo proof submitted!', proof });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;