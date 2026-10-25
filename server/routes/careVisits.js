const express = require('express');
const router = express.Router();
const CareVisit = require('../models/CareVisit');
const CareRequest = require('../models/CareRequest');
const RequestItem = require('../models/RequestItem');
const PhotoProof = require('../models/PhotoProof');
const Plant = require('../models/Plant');

// 1. ACCEPT VISIT ROUTE (PUT /api/care-visits/:visitId/accept)
router.put('/:visitId/accept', async (req, res) => {
  try {
    const { visitId } = req.params;
    const { sitterId } = req.body;

    const visit = await CareVisit.findOne({ visitId });
    if (!visit) {
      return res.status(404).json({ message: 'Visit not found in database.' });
    }

    // only a Pending visit can be taken, so a second sitter cannot overwrite the first
    if (visit.status !== 'Pending') {
      return res.status(409).json({ message: 'This visit has already been accepted.' });
    }

    visit.sitterId = Number(sitterId) || 2; // Pass numeric sitterId matching User schema
    visit.status = 'Accepted';
    await visit.save();

    // the request moves Pending -> Accepted as soon as any of its visits is taken
    await CareRequest.findOneAndUpdate(
      { requestId: visit.requestId, status: 'Pending' },
      { status: 'Accepted' }
    );

    res.json({ message: 'Visit date accepted successfully!', visit });
  } catch (err) {
    console.error('Accept visit error:', err);
    res.status(500).json({ message: err.message });
  }
});

// 2. PLANTS OF A VISIT, with plant name and photo (if any)
// GET /api/care-visits/:visitId/items
router.get('/:visitId/items', async (req, res) => {
  try {
    const { visitId } = req.params;
    const items = await RequestItem.find({ visitId });
    const proofs = await PhotoProof.find({ visitId });
    const plants = await Plant.find({ plantId: { $in: items.map((i) => i.plantId) } });

    res.json(
      items.map((item) => {
        const plant = plants.find((p) => p.plantId === item.plantId);
        return {
          ...item.toObject(),
          plantName: plant ? plant.plantName : item.plantId,
          plantPhotoUrl: plant ? plant.photoUrl : '',
          proof: proofs.find((p) => p.requestItemId === item.requestItemId) || null,
        };
      })
    );
  } catch (err) {
    console.error('Get visit items error:', err);
    res.status(500).json({ message: err.message });
  }
});

// 3. ONE PLANT'S PHOTO CHECK-IN
// POST /api/care-visits/:visitId/items/:requestItemId/check-in
router.post('/:visitId/items/:requestItemId/check-in', async (req, res) => {
  try {
    const { visitId, requestItemId } = req.params;
    const { photoUrl } = req.body;

    if (!photoUrl) {
      return res.status(400).json({ message: 'A photo is required.' });
    }

    const visit = await CareVisit.findOne({ visitId });
    if (!visit) {
      return res.status(404).json({ message: 'Visit not found.' });
    }
    if (!['Accepted', 'In Progress'].includes(visit.status)) {
      return res.status(409).json({ message: 'Accept the visit before checking in.' });
    }

    const item = await RequestItem.findOne({ requestItemId, visitId });
    if (!item) {
      return res.status(404).json({ message: 'That plant is not part of this visit.' });
    }
    if (item.status === 'Completed') {
      return res.status(409).json({ message: 'This plant already has a photo.' });
    }

    // Step A: save the photo for THIS plant
    const proof = await PhotoProof.create({
      photoProofId: 'PROOF_' + Date.now() + Math.random().toString(36).slice(2, 5),
      requestItemId,
      visitId,
      photoUrl,
    });

    // Step B: this plant is done
    item.status = 'Completed';
    await item.save();

    // Step C: visit is In Progress until the last plant has its photo
    const itemsLeft = await RequestItem.countDocuments({ visitId, status: 'Pending' });
    if (itemsLeft === 0) {
      visit.status = 'Completed';
      visit.doneAt = new Date();
    } else {
      visit.status = 'In Progress';
    }
    await visit.save();

    // Step D: request is Completed when every visit is Completed
    if (itemsLeft === 0) {
      const unfinishedVisits = await CareVisit.countDocuments({
        requestId: visit.requestId,
        status: { $ne: 'Completed' },
      });
      if (unfinishedVisits === 0) {
        await CareRequest.findOneAndUpdate(
          { requestId: visit.requestId },
          { status: 'Completed' }
        );
      }
      // TODO (tokens): payTokens(request.ownerId, visit.sitterId, request.tokenReward, visitId)
    }

    res.status(201).json({ proof, visitStatus: visit.status, itemsLeft });
  } catch (err) {
    console.error('Check-in error:', err);
    res.status(400).json({ message: err.message });
  }
});

// 2. PHOTO CHECK-IN ROUTE (POST /api/care-visits/:visitId/check-in)
// router.post('/:visitId/check-in', async (req, res) => {
//   try {
//     const { visitId } = req.params;
//     const { photoUrl } = req.body;

//     const items = await RequestItem.find({ visitId });
//     const primaryItemId = items.length > 0 ? items[0].requestItemId : 'ITEM_GENERIC';

//     // Step A: Save Photo Proof
//     const proof = new PhotoProof({
//       photoProofId: 'PROOF_' + Date.now(),
//       requestItemId: primaryItemId,
//       visitId,
//       photoUrl
//     });
//     await proof.save();

//     // Step B: Mark current visit and tasks as Completed
//     const updatedVisit = await CareVisit.findOneAndUpdate(
//       { visitId },
//       { status: 'Completed', doneAt: new Date() },
//       { new: true }
//     );
//     await RequestItem.updateMany({ visitId }, { status: 'Completed' });

//     // Step C: Auto-update parent request status if all visits are completed
//     if (updatedVisit && updatedVisit.requestId) {
//       const remainingUncompletedVisits = await CareVisit.find({
//         requestId: updatedVisit.requestId,
//         status: { $ne: 'Completed' }
//       });

//       if (remainingUncompletedVisits.length === 0) {
//         await CareRequest.findOneAndUpdate(
//           { requestId: updatedVisit.requestId },
//           { status: 'Completed' }
//         );
//       }
//     }

//     res.status(201).json({ message: 'Photo proof submitted and request status updated!', proof });
//   } catch (err) {
//     console.error('Check-in error:', err);
//     res.status(400).json({ message: err.message });
//   }
// });

module.exports = router;