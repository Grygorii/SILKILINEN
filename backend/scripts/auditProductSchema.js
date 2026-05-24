#!/usr/bin/env node
/**
 * Audit existing products against the F11 schema constraints
 * (non-empty name, non-negative price). Idempotent: only reports,
 * does not write. Pass --fix to set placeholder values on offenders
 * so the schema upgrade does not block legitimate writes elsewhere.
 *
 *   node scripts/auditProductSchema.js          # report only
 *   node scripts/auditProductSchema.js --fix    # report + repair
 *
 * Run BEFORE deploying the F11 schema change in production.
 */

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const FIX = process.argv.includes('--fix');
const PLACEHOLDER_NAME = '[unnamed product — needs review]';

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);

  // Use raw collection so we don't load the new schema (which would reject
  // these docs before we can read them).
  const col = mongoose.connection.collection('products');
  const offenders = await col.find({
    $or: [
      { name: { $in: [null, ''] } },
      { name: { $exists: false } },
      { price: { $lt: 0 } },
      { price: null },
      { price: { $exists: false } },
    ],
  }).project({ _id: 1, name: 1, price: 1, status: 1 }).toArray();

  console.log(`found ${offenders.length} product(s) failing F11 schema`);
  for (const p of offenders) {
    console.log(`  _id=${p._id}  status=${p.status}  name=${JSON.stringify(p.name)}  price=${p.price}`);
  }

  if (FIX && offenders.length > 0) {
    let touched = 0;
    for (const p of offenders) {
      const update = {};
      if (!p.name || typeof p.name !== 'string' || p.name.trim() === '') {
        update.name = PLACEHOLDER_NAME;
      }
      if (typeof p.price !== 'number' || p.price < 0) {
        update.price = 0;
      }
      // Force status to draft so a placeholder never ships to the storefront.
      update.status = 'draft';
      if (Object.keys(update).length > 0) {
        await col.updateOne({ _id: p._id }, { $set: update });
        touched++;
      }
    }
    console.log(`repaired ${touched} doc(s) — all moved to status=draft for manual review`);
  } else if (offenders.length > 0) {
    console.log('re-run with --fix to repair, or update these docs by hand before deploying F11');
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
