#!/usr/bin/env node
/**
 * Checks for delivery emails due 21 days after dispatch.
 * The server also does this hourly using the same send claim.
 *
 *   node scripts/sendReviewRequests.js              # dry-run, prints what would send
 *   node scripts/sendReviewRequests.js --send       # actually email + mark
 */

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const { processReviewRequests } = require('../services/reviewRequests');

const SEND = process.argv.includes('--send');

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

  const result = await processReviewRequests({ send: SEND });
  console.log(JSON.stringify({ mode: SEND ? 'send' : 'preview', ...result }));

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
