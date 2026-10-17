const express = require('express');
const router = express.Router();
const CareRequest = require('../models/CareRequest');
const CareVisit = require('../models/CareVisit');
const RequestItem = require('../models/RequestItem');

// GET /api/care-requests - Fetch all care requests
router.get('/', async (req, res) => {
  try {
    const requests = await CareRequest.find().sort({ createdAt: -1 });
    res.json(requests);
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
router.post('/', async (req, res) => {
  try {
    const { ownerId, startDate, endDate, note, tokenReward, plantIds } = req.body;
    
    const requestId = 'REQ_' + Date.now();
    const newRequest = new CareRequest({
      requestId,
      ownerId: Number(ownerId) || 1, // Cast numeric userId
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      note,
      tokenReward: Number(tokenReward) || 5,
      status: 'Pending'
    });
    await newRequest.save();

    // Loop through each date in range (inclusive)
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const visitDate = new Date(d);
      const visitId = 'VISIT_' + Math.random().toString(36).substring(2, 9);

      await CareVisit.create({
        visitId,
        requestId,
        visitDate,
        status: 'Pending'
      });

      const pIds = plantIds || ['PLANT_DEFAULT_1'];
      for (const plantId of pIds) {
        await RequestItem.create({
          requestItemId: 'ITEM_' + Math.random().toString(36).substring(2, 9),
          visitId,
          plantId,
          action: 'Watering & Photo Check-in',
          dueAt: visitDate
        });
      }
    }

    res.status(201).json({ message: 'Care request created successfully', data: newRequest });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;