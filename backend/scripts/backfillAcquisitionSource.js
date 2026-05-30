'use strict';

/**
 * Backfill Customer.acquisitionSource from each customer's FIRST order's
 * attribution. Going forward the checkout webhook stamps this automatically;
 * this catches customers who ordered before that wiring existed.
 *
 * Idempotent — only touches customers whose acquisitionSource is empty.
 * Run with: node backend/scripts/backfillAcquisitionSource.js
 * Preview:  node backend/scripts/backfillAcquisitionSource.js --dry-run
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Order = require('../models/Order');

const DRY_RUN = process.argv.includes('--dry-run');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
  console.log(DRY_RUN ? '-- DRY RUN — no writes --\n' : '-- LIVE RUN --\n');

  const customers = await Customer.find({
    $or: [
      { acquisitionSource: { $in: [null, ''] } },
      { acquisitionSource: { $exists: false } },
    ],
    gdprDeletedAt: null,
  }).select('email').lean();

  console.log(`${customers.length} customer(s) missing acquisitionSource.\n`);

  let updated = 0;
  let noOrder = 0;
  for (const c of customers) {
    const firstOrder = await Order.findOne({ customerEmail: c.email })
      .sort({ createdAt: 1 })
      .select('attribution createdAt')
      .lean();
    if (!firstOrder || !firstOrder.attribution) { noOrder++; continue; }

    const a = firstOrder.attribution;
    console.log(`  ${c.email} → source=${a.source} medium=${a.medium} campaign=${a.campaign}`);
    if (!DRY_RUN) {
      await Customer.updateOne({ email: c.email }, {
        $set: {
          acquisitionSource:   a.source || 'direct',
          acquisitionMedium:   a.medium || 'none',
          acquisitionCampaign: a.campaign || 'none',
          acquiredAt:          firstOrder.createdAt,
        },
      });
    }
    updated++;
  }

  console.log(`\n${DRY_RUN ? '[DRY RUN] would update' : 'Updated'} ${updated} customer(s). ${noOrder} had no orders (skipped).`);
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
