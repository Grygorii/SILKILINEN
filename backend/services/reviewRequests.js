'use strict';

// Review-request sending — shared by the in-process daily cron (server.js) and
// the manual CLI (scripts/sendReviewRequests.js). Assumes mongoose is already
// connected (the cron runs inside the live server; the script connects first).
//
// Idempotent: each order is marked with reviewRequestSentAt once sent, so
// re-running never double-emails.

const Order = require('../models/Order');
const Product = require('../models/Product');
const { signReviewToken } = require('../utils/reviewToken');
const { sendReviewRequest } = require('./email');

const SITE_URL = (process.env.SITE_URL || process.env.PUBLIC_SITE_URL || 'https://www.silkilinen.com').replace(/\/$/, '');

async function processReviewRequests({ send = true, ageDays = 14 } = {}) {
  if (send && !process.env.RESEND_API_KEY) {
    return { ran: false, reason: 'RESEND_API_KEY not set' };
  }

  const cutoff = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000);
  // Oldest-eligible first, capped per run: the daily cron then drains any
  // backlog over a few days instead of firing one unbounded burst the first
  // time RESEND_API_KEY is enabled on a store with history (Resend rate-limits).
  const eligible = await Order.find({
    status: { $in: ['paid', 'processing', 'shipped', 'delivered'] },
    customerEmail: { $exists: true, $ne: '' },
    createdAt: { $lte: cutoff },
    reviewRequestSentAt: null,
    'items.0': { $exists: true },
  }).sort({ createdAt: 1 }).limit(100).select('_id customerEmail customerName items createdAt').lean();

  let sent = 0;
  let skipped = 0;
  const log = [];

  for (const order of eligible) {
    // One review link per item carrying a real productId (bundles/legacy
    // items without one are skipped quietly).
    const productIds = [...new Set((order.items || []).map(i => String(i.productId)).filter(Boolean))];
    if (productIds.length === 0) { skipped++; continue; }

    const products = await Product.find({ _id: { $in: productIds }, status: { $ne: 'archived' } }).select('_id name').lean();
    if (products.length === 0) { skipped++; continue; }

    const links = products.map(p => ({
      name: p.name,
      url: `${SITE_URL}/write-review?token=${signReviewToken({
        orderId: order._id,
        productId: p._id,
        customerEmail: order.customerEmail,
      })}`,
    }));
    log.push(`order ${order._id} (${order.customerEmail}) — ${links.length} link(s)`);

    if (send) {
      try {
        await sendReviewRequest({ order, links });
        await Order.updateOne({ _id: order._id }, { $set: { reviewRequestSentAt: new Date() } });
        sent++;
      } catch (err) {
        console.error(`[review-requests] failed for order ${order._id}: ${err.message}`);
      }
    }
  }

  return { ran: true, send, eligible: eligible.length, sent, skipped, log };
}

module.exports = { processReviewRequests };
