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
    const body = req.body || {};
    if (!tokenTransaction.TRANSACTION_TYPES.includes(body.type)) {
      return res
        .status(400)
        .json({
          message: "Transaction type must be CARE, SYSTEM_GIFT or PENALTY",
        });
    }
    let txn;
    if (body.type === "SYSTEM_GIFT") {
      // System gifts intentionally require no authentication; validate the reward payload only.
      if (
        !Number.isSafeInteger(body.receiverId) ||
        body.receiverId < 1 ||
        !Number.isSafeInteger(body.amount) ||
        body.amount < 1 ||
        typeof body.reason !== "string" ||
        !body.reason.trim()
      ) {
        return res.status(400).json({
          message:
            "System gifts require a positive integer receiverId and amount, and a reason",
        });
      }
      if (
        body.senderId != null ||
        body.visitId != null ||
        body.requestId != null
      ) {
        return res.status(400).json({
          message: "System gifts cannot have a sender, visit or care request",
        });
      }
      txn = await tokenTransaction.createTransaction({
        type: "SYSTEM_GIFT",
        receiverId: body.receiverId,
        amount: body.amount,
        reason: body.reason.trim(),
      });
    } else if (body.type === "PENALTY") {
      // A penalty burns the sender's tokens without crediting another account.
      // Visit/request IDs are optional context; balanceApplied is never accepted from HTTP.
      if (
        !Number.isSafeInteger(body.senderId) ||
        body.senderId < 1 ||
        !Number.isSafeInteger(body.amount) ||
        body.amount < 1 ||
        typeof body.reason !== "string" ||
        !body.reason.trim() ||
        body.receiverId != null ||
        [body.visitId, body.requestId].some(
          (id) => id != null && (!Number.isSafeInteger(id) || id < 1),
        )
      ) {
        return res
          .status(400)
          .json({
            message:
              "Penalties require a positive integer senderId and amount, a reason, and no receiver; optional visitId/requestId must be positive integers",
          });
      }
      txn = await tokenTransaction.createTransaction({
        type: "PENALTY",
        senderId: body.senderId,
        amount: body.amount,
        reason: body.reason.trim(),
        visitId: body.visitId,
        requestId: body.requestId,
      });
    } else {
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
        return res.status(400).json({
          message:
            "Complete your visit with photo proof before claiming the reward",
        });
      }
      const request = await CareRequest.findOne({ requestId: visit.requestId });
      if (!request)
        return res.status(404).json({ message: "Care request not found" });
      // Derive the amount and participants from stored records, never client-supplied
      // values that could increase the reward or charge a different owner.
      txn = await tokenTransaction.createTransaction({
        type: "CARE",
        visitId: visit.visitId,
        requestId: request.requestId,
        senderId: request.ownerId,
        receiverId: visit.sitterId,
        amount: request.tokenReward,
        reason: `Reward for care visit #${visit.visitId} for request #${request.requestId}`,
      });
    }
    // All types use the same balance application and failed-transaction cleanup.
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
    res.json(
      await tokenTransaction.getTransactionsByUser(Number(req.params.userId)),
    );
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
    res.json(
      await tokenTransaction.getTransactionsByType(
        req.params.type.toUpperCase(),
      ),
    );
  } catch (err) {
    handleError(err, res);
  }
};
