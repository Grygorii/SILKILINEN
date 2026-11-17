'use strict';

const Order = require('../models/Order');
const { signReceiptToken } = require('../utils/reviewToken');
const { SHIPMENT_STATUSES } = require('../utils/orderStates');
const { siteUrl } = require('../config/site');
const { sendReviewRequest } = require('./email');

const DAY_MS = 24 * 60 * 60 * 1000;
const WAIT_MS = 21 * DAY_MS;
const CLAIM_MS = 15 * 60 * 1000;
// Resend keeps idempotency keys for 24 hours. Leave time for the request
// itself and surface unresolved attempts instead of risking another email.
const RETRY_MS = 23 * 60 * 60 * 1000;

async function processReviewRequests({ send = true, now = new Date() } = {}) {
  if (send && !process.env.RESEND_API_KEY) {
    return { ran: false, reason: 'RESEND_API_KEY not set' };
  }

  const due = {
    status: { $in: SHIPMENT_STATUSES },
    shippedAt: { $type: 'date', $lte: new Date(now.getTime() - WAIT_MS) },
    customerEmail: { $regex: /\S/ },
    reviewRequestSentAt: null,
  };
  const retryCutoff = new Date(now.getTime() - RETRY_MS);
  const eligibleFilter = {
    ...due,
    $and: [
      { $or: [{ reviewRequestStartedAt: null }, { reviewRequestStartedAt: { $gt: retryCutoff } }] },
      { $or: [{ reviewRequestClaimedAt: null }, { reviewRequestClaimedAt: { $lte: new Date(now.getTime() - CLAIM_MS) } }] },
    ],
  };
  const [eligible, needsReview] = await Promise.all([
    Order.find(eligibleFilter).sort({ shippedAt: 1 }).limit(100).select('_id').lean(),
    Order.countDocuments({ ...due, reviewRequestStartedAt: { $lte: retryCutoff } }),
  ]);
  const summary = { ran: true, eligible: eligible.length, sent: 0, skipped: 0, errors: 0, needsReview };
  if (!send) return summary;

  for (const { _id } of eligible) {
    try {
      const claimedAt = new Date();
      const order = await Order.findOneAndUpdate({ ...eligibleFilter, _id }, [{
        $set: {
          reviewRequestClaimedAt: claimedAt,
          reviewRequestStartedAt: { $ifNull: ['$reviewRequestStartedAt', claimedAt] },
        },
      }], { returnDocument: 'after', updatePipeline: true })
        .select('customerEmail shippedAt reviewRequestStartedAt').lean();
      if (!order) { summary.skipped++; continue; }

      const token = signReceiptToken(order);
      await sendReviewRequest({
        order,
        confirmUrl: siteUrl(`/write-review?receipt=1#${token}`),
        reviewUrl: siteUrl(`/write-review?receipt=review#${token}`),
      });
      const saved = await Order.updateOne(
        { _id, reviewRequestSentAt: null, reviewRequestClaimedAt: claimedAt },
        { $set: { reviewRequestSentAt: new Date() }, $unset: { reviewRequestClaimedAt: 1 } }
      );
      if (saved.modifiedCount) summary.sent++;
    } catch (err) {
      summary.errors++;
      console.error('[review-requests] send or save failed for order', _id, err.code || err.name);
    }
  }

  return summary;
}

module.exports = { processReviewRequests };
