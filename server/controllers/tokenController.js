// tokenTransactionController.js
const tokenTransaction = require("../models/tokenModel");
const userModel = require("../models/userModel");

const handleError = (err, res) => {
  console.log(err);
  if (err.status) {
    return res.status(err.status).json({ message: err.message });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json({ message: `That ${field} is already taken` });
  }
  if (err.name === "ValidationError") {
    return res.status(400).json({ message: err.message });
  }
  res.status(500).json({ message: "Server error" });
};

exports.createTokenTran = async (req, res) => {
  try {
    // Public claims are for care rewards; registration issues system gifts internally.
    if (req.body.type !== "CARE") {
      return res
        .status(400)
        .json({ message: "Only care rewards can be created here" });
    }
    const CareVisit = require("../models/careVisitModel");
    const CareRequest = require("../models/careRequestModel");
    const PhotoProof = require("../models/photoProofModel");
    // Only the authenticated sitter can claim a completed visit with saved photo proof.
    const visit = await CareVisit.findOne({
      visitId: Number(req.body.visitId),
      sitterId: req.userId,
      status: "completed",
    });
    if (!visit || !(await PhotoProof.exists({ visitId: visit.visitId }))) {
      return res
        .status(400)
        .json({
          message:
            "Complete your visit with photo proof before claiming the reward",
        });
    }
    const request = await CareRequest.findOne({ requestId: visit.requestId });
    if (!request)
      return res.status(404).json({ message: "Care request not found" });
    // Derive the amount and participants from stored records, never client-supplied
    // values that could increase the reward or charge a different owner.
    const txn = await tokenTransaction.createTransaction({
      type: "CARE",
      visitId: visit.visitId,
      requestId: request.requestId,
      senderId: request.ownerId,
      receiverId: visit.sitterId,
      amount: request.tokenReward,
      reason: `Reward for care visit #${visit.visitId} for request #${request.requestId}`,
    });
    try {
      const result = await userModel.applyTransactionToBalances(
        txn.transactionId,
      );
      res.status(201).json(result);
    } catch (err) {
      // balance update failed (e.g. insufficient funds): don't keep the record
      await tokenTransaction.TokenTransaction.deleteOne({ _id: txn._id });
      throw err;
    }
  } catch (err) {
    handleError(err, res);
  }
};

exports.getTranHistoryByUser = async (req, res) => {
  try {
    res.json(await tokenTransaction.getTransactionsByUser(Number(req.params.userId)));
  } catch (err) {
    handleError(err, res);
  }
};
exports.getAllTokenTran = async (req, res) => {
  try {
    res.json(await tokenTransaction.getAllTransactions());
  } catch (err) {
    handleError(err, res);
  }
};

exports.getTranByType = async (req, res) => {
  try {
    // uppercase so /type/care and /type/CARE both work
    res.json(await tokenTransaction.getTransactionsByType(req.params.type.toUpperCase()));
  } catch (err) {
    handleError(err, res);
  }
};
