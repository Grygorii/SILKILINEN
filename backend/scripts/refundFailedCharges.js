/**
 * Audit the last 48 h of photoshoot sessions and refund any sessions where
 * totalCost exceeds the sum of generationCost for photos that actually have
 * a URL (i.e. successfully generated images).
 *
 * Run: node backend/scripts/refundFailedCharges.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const PhotoshootSession = require('../models/PhotoshootSession');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  console.log('Connected to MongoDB\n');

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const sessions = await PhotoshootSession.find({ createdAt: { $gte: cutoff } });

  console.log(`Sessions in last 48h: ${sessions.length}\n`);

  let audited = 0;
  let overcharged = 0;
  let totalRefunded = 0;

  for (const session of sessions) {
    audited++;
    const photos = session.generatedPhotos || [];

    // Correct cost = sum of generationCost for photos that have a URL
    const correctCost = photos
      .filter(p => p.url)
      .reduce((sum, p) => sum + (p.generationCost || 0), 0);

    const recorded = session.totalCost || 0;
    const diff = recorded - correctCost;

    if (diff > 0.001) {
      overcharged++;
      totalRefunded += diff;
      console.log(
        `  Session ${session._id} — recorded €${recorded.toFixed(2)}, correct €${correctCost.toFixed(2)}, refunding €${diff.toFixed(2)}`
      );
      session.totalCost = correctCost;
      await session.save();
    }
  }

  console.log('\n── Summary ──────────────────────────────────');
  console.log(`Sessions audited:    ${audited}`);
  console.log(`Sessions corrected:  ${overcharged}`);
  console.log(`Total refunded:      €${totalRefunded.toFixed(2)}`);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
