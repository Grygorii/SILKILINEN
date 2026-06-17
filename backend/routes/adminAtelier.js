const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { aiLimit } = require('../middleware/rateLimiters');
const ExperienceReview = require('../models/ExperienceReview');
const { startReview, visionConfigured } = require('../services/atelier');

router.use(requireAuth);

// POST /review — start a whole-house walk-through (runs in the background; the
// client polls GET /:id until status leaves 'running').
router.post('/review', aiLimit, async (req, res) => {
  try {
    const review = await startReview({ triggeredBy: req.user?.email || 'admin' });
    res.status(202).json(review);
  } catch (err) {
    console.error('[atelier] review:', err.message);
    res.status(503).json({ error: err.message || 'The Atelier could not start the review — try again.' });
  }
});

// GET / — recent reviews + whether vision is configured.
router.get('/', async (req, res) => {
  try {
    const reviews = await ExperienceReview.find({}).sort({ createdAt: -1 }).limit(20).lean();
    res.json({ visionReady: visionConfigured(), reviews });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id — one review.
router.get('/:id', async (req, res) => {
  try {
    const review = await ExperienceReview.findById(req.params.id).lean();
    if (!review) return res.status(404).json({ error: 'Not found' });
    res.json(review);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
