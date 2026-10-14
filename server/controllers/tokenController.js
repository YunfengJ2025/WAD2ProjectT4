// tokenTransactionController.js
const model = require("./tokenTransactionModel");
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
    res.status(201).json(txn);
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
