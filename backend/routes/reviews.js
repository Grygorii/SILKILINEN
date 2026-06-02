const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const Review = require('../models/Review');
const Product = require('../models/Product');
const { flagReview } = require('../services/reviewModeration');

// 3 review submissions per IP per hour. Reviews are usually a once-per-
// product action, so any IP submitting more is either a moderator
// testing or a spammer. Skip in non-prod so dev seeds still work.
const submitRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many review submissions. Please try again later.' },
  skip: () => process.env.NODE_ENV !== 'production',
});

// ── GET /api/reviews — public list ────────────────────────────────────
// Backward-compatible: if no params, returns the legacy array shape the
// homepage carousel expects. Only ever returns status=approved reviews
// so pending/rejected/spam never leak to the storefront.
router.get('/', async function(req, res) {
  try {
    const { sort = 'recent', page, limit, productId } = req.query;
    const filter = { status: 'approved', starRating: { $gte: 3 } };
    if (productId) filter.productId = productId;

    if (!page && !limit && sort === 'recent' && !productId) {
      const reviews = await Review.find(filter)
        .sort({ dateReviewed: -1 })
        .select('-__v -ip -userAgent');
      return res.json(reviews);
    }

    const sortMap = {
      recent:  { dateReviewed: -1 },
      helpful: { helpfulCount: -1, dateReviewed: -1 },
      highest: { starRating: -1, dateReviewed: -1 },
    };
    const sortObj = sortMap[sort] || sortMap.recent;

    const pageNum  = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10));
    const skip     = (pageNum - 1) * limitNum;

    const [reviews, total] = await Promise.all([
      Review.find(filter).sort(sortObj).skip(skip).limit(limitNum)
        .populate('productId', 'name slug images')
        .select('-__v -ip -userAgent'),
      Review.countDocuments(filter),
    ]);

    res.json({ reviews, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/reviews/summary — brand aggregate ────────────────────────
router.get('/summary', async function(req, res) {
  try {
    const { productId } = req.query;
    const filter = { status: 'approved' };
    if (productId) filter.productId = productId;

    const all = await Review.find(filter).select('starRating');
    if (all.length === 0) return res.json({ average: 0, count: 0, distribution: {} });

    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sum = 0;
    for (const r of all) {
      distribution[r.starRating] = (distribution[r.starRating] || 0) + 1;
      sum += r.starRating;
    }

    res.json({
      average: Math.round((sum / all.length) * 10) / 10,
      count: all.length,
      distribution,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/reviews — customer submission ───────────────────────────
// New reviews always land as status=pending. The auto-flag heuristics
// add advisory tags so the admin can triage quickly but every review
// still requires manual approval before going live.
router.post('/', submitRateLimit, async function(req, res) {
  try {
    const { reviewer, title, message, starRating, productId } = req.body;

    // Hard guards before heuristics
    if (!reviewer || typeof reviewer !== 'string') {
      return res.status(400).json({ error: 'Reviewer name is required.' });
    }
    const rating = Number(starRating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 5.' });
    }
    if (typeof message === 'string' && message.length > 2000) {
      return res.status(400).json({ error: 'Review is too long (max 2000 characters).' });
    }

    // Honeypot field — bots typically fill every input. Real users never
    // see this. If anything is submitted in it, drop the request silently
    // with a 200 so the bot moves on.
    if (req.body.website || req.body.url) {
      return res.json({ success: true });
    }

    // Verify productId points at a real active product if supplied
    let resolvedProductId = null;
    if (productId) {
      const product = await Product.findById(productId).select('_id').lean();
      if (!product) return res.status(400).json({ error: 'Product not found.' });
      resolvedProductId = product._id;
    }

    const flagReasons = flagReview({ reviewer, title, message });

    const review = await Review.create({
      reviewer: reviewer.trim(),
      title: typeof title === 'string' ? title.trim() : '',
      message: typeof message === 'string' ? message.trim() : '',
      starRating: rating,
      productId: resolvedProductId,
      source: 'site',
      status: 'pending',
      verified: false, // legacy field; cleared until admin approves
      flagReasons,
      ip: req.ip,
      userAgent: req.get('user-agent') || '',
    });

    // Don't leak the audit fields back to the submitter
    res.status(201).json({
      success: true,
      review: {
        _id: review._id,
        reviewer: review.reviewer,
        starRating: review.starRating,
        status: review.status,
        message: 'Thank you — your review will appear once approved by our team.',
      },
    });
  } catch (err) {
    console.error('[reviews] submission error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/reviews/:id/helpful ─────────────────────────────────────
router.post('/:id/helpful', async function(req, res) {
  try {
    const review = await Review.findOneAndUpdate(
      { _id: req.params.id, status: 'approved' },
      { $inc: { helpfulCount: 1 } },
      { new: true, select: 'helpfulCount' }
    );
    if (!review) return res.status(404).json({ error: 'Review not found' });
    res.json({ helpfulCount: review.helpfulCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
