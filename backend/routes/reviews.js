const express = require('express');
const router = express.Router();
const Review = require('../models/Review');

// GET /api/reviews — paginated, filterable. Returns flat array for backward compat when no query params.
router.get('/', async function(req, res) {
  try {
    const { verified, sort = 'recent', page, limit } = req.query;

    // Backward-compat: homepage calls with no params and expects a plain array
    if (!page && !limit && !verified && sort === 'recent') {
      const reviews = await Review.find({ verified: true, starRating: { $gte: 3 } })
        .sort({ dateReviewed: -1 })
        .select('-__v');
      return res.json(reviews);
    }

    const filter = { starRating: { $gte: 3 } };
    if (verified === 'true') filter.verified = true;

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
      Review.find(filter).sort(sortObj).skip(skip).limit(limitNum).select('-__v'),
      Review.countDocuments(filter),
    ]);

    res.json({ reviews, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reviews/summary — aggregate stats
router.get('/summary', async function(req, res) {
  try {
    const all = await Review.find({ verified: true }).select('starRating');
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
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reviews/:id/helpful — increment helpful count
router.post('/:id/helpful', async function(req, res) {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { $inc: { helpfulCount: 1 } },
      { new: true, select: 'helpfulCount' }
    );
    if (!review) return res.status(404).json({ error: 'Review not found' });
    res.json({ helpfulCount: review.helpfulCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
