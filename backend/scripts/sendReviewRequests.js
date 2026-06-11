#!/usr/bin/env node
/**
 * Manual CLI for the review-request sender. The actual logic lives in
 * services/reviewRequests.js (shared with the in-process daily cron in
 * server.js, which now runs this automatically — you don't need a separate
 * scheduler). Marks reviewRequestSentAt so re-running is a no-op.
 *
 *   node scripts/sendReviewRequests.js              # dry-run, prints what would send
 *   node scripts/sendReviewRequests.js --send       # actually email + mark
 *   node scripts/sendReviewRequests.js --send --age=7   # change cooldown
 */

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const { processReviewRequests } = require('../services/reviewRequests');

const SEND = process.argv.includes('--send');
const ageArg = (process.argv.find(a => a.startsWith('--age=')) || '').split('=')[1];
const AGE_DAYS = Number.isFinite(parseInt(ageArg)) ? parseInt(ageArg) : 14;

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set.');
    process.exit(1);
  }
  if (SEND && !process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY not set — would send nothing. Aborting.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);

  const result = await processReviewRequests({ send: SEND, ageDays: AGE_DAYS });
  console.log(`[review-requests] mode=${SEND ? 'SEND' : 'DRY-RUN'}, eligible=${result.eligible ?? 0}`);
  for (const line of result.log || []) console.log('  ' + line);
  console.log(`[review-requests] done. sent=${result.sent ?? 0}, skipped(no-products)=${result.skipped ?? 0}`);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
