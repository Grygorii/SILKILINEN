/**
 * One-shot script: reset totalCost to 0 for sessions where validation
 * failures caused incorrect charges (all photos in forReview state).
 *
 * Run once: node backend/scripts/refundFailedSessions.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const PhotoshootSession = require('../models/PhotoshootSession');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const sessions = await PhotoshootSession.find({ status: 'in-progress' });
  let refunded = 0;

  for (const session of sessions) {
    const photos = session.generatedPhotos || [];
    if (photos.length === 0) continue;

    // Session where every photo was in forReview (zero usable results)
    const allFailed = photos.every(p => p.forReview === true);
    if (allFailed && session.totalCost > 0) {
      console.log(`  Refunding session ${session._id} — was €${session.totalCost.toFixed(2)}, all photos in review`);
      session.totalCost = 0;
      await session.save();
      refunded++;
    }
  }

  console.log(`Done. Refunded ${refunded} session(s).`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
