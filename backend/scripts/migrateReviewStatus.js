#!/usr/bin/env node
/**
 * One-time migration: every existing Review gets status='approved' so
 * the storefront feed doesn't go blank the moment the new moderation
 * pipeline ships. New reviews submitted via /api/reviews after this
 * point start as 'pending' and need admin approval.
 *
 *   node scripts/migrateReviewStatus.js          # report only
 *   node scripts/migrateReviewStatus.js --apply  # actually write
 *
 * Idempotent. Safe to re-run.
 */

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);

  const col = mongoose.connection.collection('reviews');

  // Anything without a status field yet is a pre-moderation review and
  // should be approved. Reviews already carrying a status are left alone.
  const candidates = await col.countDocuments({ status: { $exists: false } });

  console.log(`found ${candidates} review(s) without a status field`);

  if (!APPLY) {
    console.log('\nre-run with --apply to set status="approved" on all of them');
    await mongoose.disconnect();
    return;
  }

  const result = await col.updateMany(
    { status: { $exists: false } },
    { $set: { status: 'approved', verified: true } },
  );

  console.log(`\nupdated ${result.modifiedCount} review(s) → status="approved"`);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
