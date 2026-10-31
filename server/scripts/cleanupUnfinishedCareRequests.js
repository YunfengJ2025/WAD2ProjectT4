// One-time cleanup: preview by default; pass --apply to remove the previewed records.
// Completed requests are preserved. Visits belonging to unfinished requests are
// removed regardless of visit status, together with their proof and review records.
require('dotenv').config();
// Match server.js DNS configuration for resolving the Atlas SRV connection string.
require('node:dns').setServers(['1.1.1.1', '8.8.8.8']);
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const CareRequest = require('../models/careRequestModel');
const CareVisit = require('../models/careVisitModel');
const RequestItem = require('../models/requestItemModel');
const PhotoProof = require('../models/photoProofModel');
const { Review } = require('../models/reviewModel');
const { User } = require('../models/userModel');
const { TokenTransaction } = require('../models/tokenModel');

async function main() {
  await mongoose.connect(process.env.DB, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 15000 });
  const session = await mongoose.startSession();
  let proofs = [];
  try {
    await session.withTransaction(async () => {
      const requests = await CareRequest.find({ status: { $in: ['funding', 'open', 'in_progress'] } }).session(session).lean();
      const requestIds = requests.map((item) => item.requestId);
      const visits = await CareVisit.find({ requestId: { $in: requestIds } }).session(session).lean();
      const visitIds = visits.map((item) => item.visitId);
      const items = await RequestItem.find({ visitId: { $in: visitIds } }).session(session).lean();
      proofs = await PhotoProof.find({ $or: [
        { visitId: { $in: visitIds } }, { requestItemId: { $in: items.map((item) => item.requestItemId) } },
      ] }).session(session).lean();
      const reviews = await Review.find({ type: 'VISIT', visitId: { $in: visitIds } }).session(session).lean();
      const users = await User.find({ 'tokenReservations.requestId': { $in: requestIds } })
        .select('userId tokenBalance tokenReservations').session(session).lean();
      // Payments already made remain in the ledger and balances stay unchanged.
      // Removing reservations only makes the remaining frozen tokens available again.
      const transactions = await TokenTransaction.find({ type: 'CARE', visitId: { $in: visitIds } }).session(session).lean();
      const releasedTokens = users.reduce((sum, user) => sum + user.tokenReservations
        .filter((item) => requestIds.includes(item.requestId)).reduce((total, item) => total + item.amount, 0), 0);
      console.log(JSON.stringify({ mode: process.argv.includes('--apply') ? 'apply' : 'preview',
        requestIds, requests: requests.length, visits: visits.length, requestItems: items.length,
        photoProofs: proofs.length, hostedPhotos: proofs.filter((item) => item.photoPublicId).length,
        reviews: reviews.length, affectedUsers: users.length, releasedTokens,
        retainedCareTransactions: transactions.length,
      }, null, 2));
      if (!process.argv.includes('--apply') || !requests.length) return;

      // Write a BSON-aware backup before deleting, preserving IDs and dates for recovery.
      const backupDir = path.resolve(__dirname, '../.cleanup-backups');
      fs.mkdirSync(backupDir, { recursive: true });
      fs.writeFileSync(path.join(backupDir, '.gitignore'), '*\n');
      const backupPath = path.join(backupDir, `care-cleanup-${Date.now()}.json`);
      fs.writeFileSync(backupPath, mongoose.mongo.BSON.EJSON.stringify({ requests, visits, items, proofs, reviews, users, transactions }, null, 2), { flag: 'wx' });
      console.log(`Backup: ${backupPath}`);

      // One transaction prevents partial database cleanup if any deletion fails.
      await PhotoProof.deleteMany({ _id: { $in: proofs.map((item) => item._id) } }).session(session);
      await Review.deleteMany({ _id: { $in: reviews.map((item) => item._id) } }).session(session);
      await RequestItem.deleteMany({ _id: { $in: items.map((item) => item._id) } }).session(session);
      await CareVisit.deleteMany({ _id: { $in: visits.map((item) => item._id) } }).session(session);
      await User.updateMany({ 'tokenReservations.requestId': { $in: requestIds } },
        { $pull: { tokenReservations: { requestId: { $in: requestIds } } } }).session(session);
      await CareRequest.deleteMany({ _id: { $in: requests.map((item) => item._id) } }).session(session);
    });
  } finally { await session.endSession(); }

  // Delete hosted proof images only after database cleanup commits successfully.
  if (process.argv.includes('--apply') && proofs.some((item) => item.photoPublicId)) {
    const { v2: cloudinary } = require('cloudinary');
    cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
    for (const publicId of new Set(proofs.map((item) => item.photoPublicId).filter(Boolean))) {
      const result = await cloudinary.uploader.destroy(publicId);
      if (!['ok', 'not found'].includes(result.result)) throw new Error(`Proof image cleanup failed: ${publicId}`);
    }
    console.log('Hosted proof images removed.');
  }
}

main().catch((err) => { console.error(err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
