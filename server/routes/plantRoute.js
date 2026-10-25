const Plant = require('../models/Plant');

// TEMPORARY: swap for the plant-profile teammate's endpoint after merging
// GET /api/care-requests/plants/:ownerId
router.get('/plants/:ownerId', async (req, res) => {
  try {
    const plants = await Plant.find({ ownerId: String(req.params.ownerId) });
    res.json(plants);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});