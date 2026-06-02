#!/usr/bin/env node
/**
 * Scan paid orders that are ≥14 days old, haven't had a review-request
 * sent yet, and have at least one productId on a line item — then send
 * one review-request email per order. Marks reviewRequestSentAt so
 * re-running is a no-op.
 *
 *   node scripts/sendReviewRequests.js              # dry-run, prints what would send
 *   node scripts/sendReviewRequests.js --send       # actually email + mark
 *   node scripts/sendReviewRequests.js --send --age=7   # change cooldown
 *
 * Safe to schedule weekly on Railway cron. Adds a SITE_URL fallback to
 * https://www.silkilinen.com so the links match the canonical domain.
 */

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { signReviewToken } = require('../utils/reviewToken');
const { sendReviewRequest } = require('../services/email');

const SEND = process.argv.includes('--send');
const ageArg = (process.argv.find(a => a.startsWith('--age=')) || '').split('=')[1];
const AGE_DAYS = Number.isFinite(parseInt(ageArg)) ? parseInt(ageArg) : 14;
const SITE_URL = (process.env.SITE_URL || 'https://www.silkilinen.com').replace(/\/$/, '');

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

  const cutoff = new Date(Date.now() - AGE_DAYS * 24 * 60 * 60 * 1000);
  const eligible = await Order.find({
    status: { $in: ['paid', 'shipped', 'delivered'] },
    customerEmail: { $exists: true, $ne: '' },
    createdAt: { $lte: cutoff },
    reviewRequestSentAt: null,
    'items.0': { $exists: true },
  }).select('_id customerEmail customerName items createdAt').lean();

  console.log(`[review-requests] cutoff=${cutoff.toISOString()}, eligible orders=${eligible.length}, mode=${SEND ? 'SEND' : 'DRY-RUN'}`);

  let sent = 0;
  let skipped = 0;

  for (const order of eligible) {
    // Build one link per item that carries a real productId. Bundles or
    // legacy items without a productId are skipped quietly.
    const productIds = [...new Set((order.items || []).map(i => String(i.productId)).filter(Boolean))];
    if (productIds.length === 0) {
      skipped++;
      continue;
    }

    const products = await Product.find({ _id: { $in: productIds }, status: { $ne: 'archived' } }).select('_id name').lean();
    if (products.length === 0) {
      skipped++;
      continue;
    }

    const links = products.map(p => ({
      name: p.name,
      url: `${SITE_URL}/write-review?token=${signReviewToken({
        orderId: order._id,
        productId: p._id,
        customerEmail: order.customerEmail,
      })}`,
    }));

    console.log(`  order ${order._id} (${order.customerEmail}) — ${links.length} link(s)`);
    for (const l of links) console.log(`    - ${l.name}`);

    if (SEND) {
      try {
        await sendReviewRequest({ order, links });
        await Order.updateOne({ _id: order._id }, { $set: { reviewRequestSentAt: new Date() } });
        sent++;
      } catch (err) {
        console.error(`    [error] failed to send for order ${order._id}: ${err.message}`);
      }
    }
  }

  console.log(`\n[review-requests] done. sent=${sent}, skipped(no-products)=${skipped}, total-eligible=${eligible.length}`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
