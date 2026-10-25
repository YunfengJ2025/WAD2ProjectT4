const express = require('express');
const router = express.Router();
const CareRequest = require('../models/CareRequest');
const CareVisit = require('../models/CareVisit');
const RequestItem = require('../models/RequestItem');
const Plant = require('../models/Plant');

// GET /api/care-requests - Fetch all care requests
router.get('/', async (req, res) => {
  try {
    const requests = await CareRequest.find().sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// TEMPORARY: swap for the plant-profile teammate's endpoint after merging.
// Must stay ABOVE '/:requestId', otherwise "plants" is read as a request id.
// GET /api/care-requests/plants/:ownerId
router.get('/plants/:ownerId', async (req, res) => {
  try {
    const plants = await Plant.find({ ownerId: String(req.params.ownerId) });
    res.json(plants);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/care-requests/:requestId - Fetch single request
router.get('/:requestId', async (req, res) => {
  try {
    const request = await CareRequest.findOne({ requestId: req.params.requestId });
    if (!request) return res.status(404).json({ message: 'Request not found' });
    res.json(request);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/care-requests/:requestId/visits - Fetch visits for a request
router.get('/:requestId/visits', async (req, res) => {
  try {
    const visits = await CareVisit.find({ requestId: req.params.requestId }).sort({ visitDate: 1 });
    res.json(visits);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/care-requests - Create care request and generate daily visits
// body: { ownerId, startDate, endDate, note, tokenReward,
//         days: [{ date: '2026-10-25', plantIds: ['P1','P2'] }, ...] }
router.post('/', async (req, res) => {
  try {
    const { ownerId, startDate, endDate, note, tokenReward, days } = req.body;

    // keep only days that actually have plants
    const visitDays = (days || []).filter((d) => d.plantIds && d.plantIds.length > 0);
    if (visitDays.length === 0) {
      return res.status(400).json({ message: 'No plants need watering in that date range.' });
    }

    const requestId = 'REQ_' + Date.now();
    const newRequest = await CareRequest.create({
      requestId,
      ownerId: Number(ownerId) || 1,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      note,
      tokenReward: Number(tokenReward) || 5,
      status: 'Pending',
    });

    // TODO (tokens): holdTokens(newRequest.ownerId, newRequest.tokenReward * visitDays.length, requestId)

    for (const day of visitDays) {
      const visitId = 'VISIT_' + Math.random().toString(36).substring(2, 9);
      const visitDate = new Date(day.date + 'T00:00:00'); // local day, no UTC shift

      await CareVisit.create({ visitId, requestId, visitDate, status: 'Pending' });

      for (const plantId of day.plantIds) {
        await RequestItem.create({
          requestItemId: 'ITEM_' + Math.random().toString(36).substring(2, 9),
          visitId,
          plantId: String(plantId),
          action: 'Watering & Photo Check-in',
          dueAt: visitDate,
          originalDueAt: visitDate,
        });
      }
    }

    res.status(201).json({ message: 'Care request created successfully', data: newRequest });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message });
  }
});

// old
// router.post('/', async (req, res) => {
//   try {
//     const { ownerId, startDate, endDate, note, tokenReward, plantIds } = req.body;
    
//     const requestId = 'REQ_' + Date.now();
//     const newRequest = new CareRequest({
//       requestId,
//       ownerId: Number(ownerId) || 1, // Cast numeric userId
//       startDate: new Date(startDate),
//       endDate: new Date(endDate),
//       note,
//       tokenReward: Number(tokenReward) || 5,
//       status: 'Pending'
//     });
//     await newRequest.save();

//     // Loop through each date in range (inclusive)
//     const start = new Date(startDate);
//     const end = new Date(endDate);
    
//     for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
//       const visitDate = new Date(d);
//       const visitId = 'VISIT_' + Math.random().toString(36).substring(2, 9);

//       await CareVisit.create({
//         visitId,
//         requestId,
//         visitDate,
//         status: 'Pending'
//       });

//       const pIds = plantIds || ['PLANT_DEFAULT_1'];
//       for (const plantId of pIds) {
//         await RequestItem.create({
//           requestItemId: 'ITEM_' + Math.random().toString(36).substring(2, 9),
//           visitId,
//           plantId,
//           action: 'Watering & Photo Check-in',
//           dueAt: visitDate
//         });
//       }
//     }

//     res.status(201).json({ message: 'Care request created successfully', data: newRequest });
//   } catch (err) {
//     console.error(err);
//     res.status(400).json({ message: err.message });
//   }
// });

module.exports = router;