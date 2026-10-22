// tokenTransactionController.js
const model = require("../models/tokenModel");
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
    const txn = await model.createTransaction(req.body);
    try {
      const result = await userModel.applyTransactionToBalances(
        txn.transactionId,
      );
      res.status(201).json(result);
    } catch (err) {
      // balance update failed (e.g. insufficient funds): don't keep the record
      await model.TokenTransaction.deleteOne({ _id: txn._id });
      throw err;
    }
  } catch (err) {
    handleError(err, res);
  }
};

exports.getTranHistoryByUser = async (req, res) => {
  try {
    res.json(await model.getTransactionsByUser(Number(req.params.userId)));
  } catch (err) {
    handleError(err, res);
  }
};
exports.getAllTokenTran = async (req, res) => {
  try {
    res.json(await model.getAllTransactions());
  } catch (err) {
    handleError(err, res);
  }
};

exports.getTranByType = async (req, res) => {
  try {
    // uppercase so /type/care and /type/CARE both work
    res.json(await model.getTransactionsByType(req.params.type.toUpperCase()));
  } catch (err) {
    handleError(err, res);
  }
};
