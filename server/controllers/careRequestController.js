const CareRequest = require('../models/careRequestModel');
const CareVisit = require('../models/careVisitModel');
const RequestItem = require('../models/requestItemModel');
const PhotoProof = require('../models/photoProofModel');
const User = require('../models/userModel');
const TokenTransaction = require('../models/tokenTransactionModel');

// 1. Owner creates a care request, handling token deduction and generating related visits/items
exports.createCareRequest = async (req, res) => {
  try {
    const { ownerId, startDate, endDate, note, tokenReward, plantIds, visitDates } = req.body;
    
    const owner = await User.findById(ownerId);
    if (!owner || owner.tokenBalance < tokenReward * visitDates.length) {
      return res.status(400).json({ message: 'Insufficient token balance to post request.' });
    }

    // Deduct tokens from owner
    owner.tokenBalance -= tokenReward * visitDates.length;
    await owner.save();

    // Create CareRequest (using requestID)
    const newRequest = await CareRequest.create({
      ownerId,
      startDate,
      endDate,
      Note: note,
      tokenReward,
      status: 'Pending'
    });

    // Create CareVisits and RequestItems for each date
    for (const date of visitDates) {
      const visit = await CareVisit.create({
        requestId: newRequest.requestID,
        visitDate: new Date(date),
        status: 'Pending'
      });

      for (const plantId of plantIds) {
        await RequestItem.create({
          visitId: visit.visitID,
          plantId: plantId,
          Action: 'Watering',
          status: 'Pending',
          originalDueAt: new Date(date)
        });
      }
    }

    res.status(201).json({ message: 'Care request successfully posted', data: newRequest });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 2. Sitter accepts an individual visit date
exports.acceptVisit = async (req, res) => {
  try {
    const { visitID } = req.params;
    const { sitterId } = req.body;

    const visit = await CareVisit.findOne({ visitID });
    if (!visit) return res.status(404).json({ message: 'Care visit not found' });
    if (visit.status !== 'Pending') return res.status(400).json({ message: 'Visit already accepted' });

    visit.sitterId = sitterId;
    visit.status = 'Accepted';
    await visit.save();

    res.status(200).json({ message: 'Visit accepted successfully', data: visit });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 3. Sitter submits check-in photo proof, completes items, and earns tokens
exports.submitPhotoProof = async (req, res) => {
  try {
    const { visitID } = req.params;
    const { requestItemId, photoUrl } = req.body;

    const visit = await CareVisit.findOne({ visitID });
    if (!visit) return res.status(404).json({ message: 'Care visit not found' });

    const proof = await PhotoProof.create({
      requestItemId,
      visitId: visitID,
      photoUrl,
      takenAt: new Date()
    });

    await RequestItem.findByIdAndUpdate(requestItemId, { status: 'Completed' });
    visit.status = 'Completed';
    visit.doneAt = new Date();
    await visit.save();

    // Reward sitter with tokens upon completion
    const request = await CareRequest.findOne({ requestID: visit.requestId });
    const sitter = await User.findById(visit.sitterId);

    if (sitter && request) {
      sitter.tokenBalance += request.tokenReward;
      await sitter.save();

      await TokenTransaction.create({
        visitId: visit.visitID,
        senderId: request.ownerId,
        receiverId: visit.sitterId,
        Amount: request.tokenReward,
        reason: 'Completed visit with photo proof check-in'
      });
    }

    res.status(200).json({ message: 'Check-in recorded and token reward transferred', data: proof });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};