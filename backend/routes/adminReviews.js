const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { requireAuth } = require('../middleware/auth');
const { emailBlastLimit } = require('../middleware/rateLimiters');
const { flagLabel } = require('../services/reviewModeration');
const { signReviewToken } = require('../utils/reviewToken');
const { sendReviewRequest } = require('../services/email');

const SITE_URL = (process.env.SITE_URL || 'https://www.silkilinen.com').replace(/\/$/, '');

router.use(requireAuth);

// ── GET /api/admin/reviews — full list with filters ───────────────────
// Filters: ?status=pending|approved|rejected|spam|all
//          ?productId=<id>
//          ?flagged=true (any flagReasons set)
//          ?q=<text> (matches reviewer or message)
//          ?page=<n>&limit=<n>
router.get('/', async function(req, res) {
  try {
    const { status = 'all', productId, flagged, q, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status !== 'all') filter.status = status;
    if (productId) filter.productId = productId;
    if (flagged === 'true') filter['flagReasons.0'] = { $exists: true };
    if (q && typeof q === 'string' && q.trim()) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ reviewer: re }, { message: re }, { title: re }];
    }

    const pageNum  = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const skip     = (pageNum - 1) * limitNum;

    const [reviews, total, counts] = await Promise.all([
      Review.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('productId', 'name slug images')
        .populate('moderatedBy', 'email')
        .lean(),
      Review.countDocuments(filter),
      Review.aggregate([
        { $group: { _id: '$status', n: { $sum: 1 } } },
      ]),
    ]);

    // Decorate flag tags with human labels for the admin UI.
    const decorated = reviews.map(r => ({
      ...r,
      flagLabels: (r.flagReasons || []).map(flagLabel),
    }));

    const tabCounts = { pending: 0, approved: 0, rejected: 0, spam: 0 };
    for (const c of counts) tabCounts[c._id] = c.n;

    res.json({
      reviews: decorated,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      tabCounts,
    });
  } catch (err) {
    console.error('[adminReviews] list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /api/admin/reviews/:id — moderation actions ─────────────────
// Body shape:
//   { action: 'approve' | 'reject' | 'spam' | 'edit', reason?, edit? }
// edit accepts: { reviewer, title, message, starRating, productId }
router.patch('/:id', async function(req, res) {
  try {
    const { action, reason, edit } = req.body || {};
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ error: 'Review not found' });

    if (action === 'approve') {
      review.status = 'approved';
      review.verified = true; // keep legacy field in sync for older queries
      review.rejectionReason = '';
    } else if (action === 'reject') {
      review.status = 'rejected';
      review.verified = false;
      review.rejectionReason = typeof reason === 'string' ? reason.slice(0, 280) : '';
    } else if (action === 'spam') {
      review.status = 'spam';
      review.verified = false;
      review.rejectionReason = 'Marked as spam by admin';
    } else if (action === 'edit') {
      if (!edit || typeof edit !== 'object') {
        return res.status(400).json({ error: 'edit payload required' });
      }
      if (typeof edit.reviewer === 'string') review.reviewer = edit.reviewer.trim().slice(0, 80);
      if (typeof edit.title === 'string') review.title = edit.title.trim().slice(0, 120);
      if (typeof edit.message === 'string') review.message = edit.message.trim().slice(0, 2000);
      if (Number.isInteger(edit.starRating) && edit.starRating >= 1 && edit.starRating <= 5) {
        review.starRating = edit.starRating;
      }
      // productId: null = unlink, undefined = leave alone, valid id = relink
      if (edit.productId === null) {
        review.productId = null;
      } else if (typeof edit.productId === 'string') {
        review.productId = edit.productId;
      }
    } else {
      return res.status(400).json({ error: 'Invalid action. Use approve, reject, spam, or edit.' });
    }

    review.moderatedBy = req.user.userId;
    review.moderatedAt = new Date();
    await review.save();

    res.json({ success: true, review });
  } catch (err) {
    console.error('[adminReviews] moderation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/admin/reviews/:id — hard delete ───────────────────────
// Only for emergencies (legal takedown, accidental import). Normal flow
// is reject/spam which keeps the row for audit.
router.delete('/:id', async function(req, res) {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) return res.status(404).json({ error: 'Review not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/admin/reviews/send-pending-requests ────────────────────
// Manually trigger the post-purchase review-request scan. Same logic as
// scripts/sendReviewRequests.js but callable from the admin UI so the
// operator doesn't need shell access. Body: { ageDays?: number, dryRun?: boolean }
//
// Returns a `diagnostics` block that breaks down WHY each order didn't
// qualify — without it "Eligible: 0" is impossible to debug from the
// admin UI alone. Each non-eligible order falls into exactly one bucket.
router.post('/send-pending-requests', emailBlastLimit, async function(req, res) {
  try {
    const ageDays = Number.isInteger(req.body?.ageDays) ? req.body.ageDays : 14;
    const dryRun = Boolean(req.body?.dryRun);

    if (!dryRun && !process.env.RESEND_API_KEY) {
      return res.status(503).json({ error: 'RESEND_API_KEY not configured; cannot send.' });
    }

    const cutoff = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000);

    // Pull every order, then bucket on the JS side so we can report on
    // each disqualification reason. Cheap at <10k orders; revisit if
    // the order table outgrows that.
    const allOrders = await Order.find({}).select('_id status customerEmail items createdAt reviewRequestSentAt').lean();

    const diagnostics = {
      totalOrders: allOrders.length,
      excludedByStatus: 0,
      excludedByMissingEmail: 0,
      excludedByTooFresh: 0,
      excludedByAlreadySent: 0,
      excludedByNoItems: 0,
    };
    const ELIGIBLE_STATUSES = new Set(['paid', 'processing', 'shipped', 'delivered']);
    const eligible = [];

    for (const o of allOrders) {
      // Order of checks mirrors how the operator typically thinks: real
      // order? cooled down? not already sent? has products?
      if (!ELIGIBLE_STATUSES.has(o.status)) { diagnostics.excludedByStatus++; continue; }
      if (!o.customerEmail || o.customerEmail.trim() === '') { diagnostics.excludedByMissingEmail++; continue; }
      if (!o.createdAt || new Date(o.createdAt) > cutoff) { diagnostics.excludedByTooFresh++; continue; }
      if (o.reviewRequestSentAt) { diagnostics.excludedByAlreadySent++; continue; }
      if (!o.items || o.items.length === 0) { diagnostics.excludedByNoItems++; continue; }
      eligible.push(o);
    }

    const summary = { eligible: eligible.length, sent: 0, skipped: 0, errors: 0, sample: [], diagnostics };

    for (const order of eligible) {
      const productIds = [...new Set((order.items || []).map(i => String(i.productId)).filter(Boolean))];
      if (productIds.length === 0) { summary.skipped++; continue; }

      const products = await Product.find({ _id: { $in: productIds }, status: { $ne: 'archived' } }).select('_id name').lean();
      if (products.length === 0) { summary.skipped++; continue; }

      const links = products.map(p => ({
        name: p.name,
        url: `${SITE_URL}/write-review?token=${signReviewToken({
          orderId: order._id,
          productId: p._id,
          customerEmail: order.customerEmail,
        })}`,
      }));

      if (summary.sample.length < 5) {
        summary.sample.push({ orderId: String(order._id), email: order.customerEmail, items: links.map(l => l.name) });
      }

      if (!dryRun) {
        try {
          await sendReviewRequest({ order, links });
          await Order.updateOne({ _id: order._id }, { $set: { reviewRequestSentAt: new Date() } });
          summary.sent++;
        } catch (err) {
          console.error(`[adminReviews] send failure for order ${order._id}: ${err.message}`);
          summary.errors++;
        }
      }
    }

    res.json({ success: true, dryRun, ageDays, ...summary });
  } catch (err) {
    console.error('[adminReviews] send-pending-requests error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
