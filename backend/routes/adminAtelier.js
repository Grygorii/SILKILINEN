const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { aiLimit } = require('../middleware/rateLimiters');
const ExperienceReview = require('../models/ExperienceReview');
const { startReview, visionConfigured } = require('../services/atelier');
const { generateAltText, countWeakAlt } = require('../services/atelierAlt');

router.use(requireAuth);

// GET /alt — how many product photos still need alt text (drives the button label).
router.get('/alt', async (req, res) => {
  try {
    res.json({ visionReady: visionConfigured(), ...(await countWeakAlt()) });
  } catch (err) {
    console.error('[atelier] alt count:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /alt — the Atelier looks at each product photo and writes its alt text.
// Auto-applies (a missing alt is strictly worse than an imperfect one). Pass
// { force: true } to re-write every alt, not just the weak/missing ones.
router.post('/alt', aiLimit, async (req, res) => {
  try {
    const out = await generateAltText({ force: Boolean(req.body?.force) });
    res.json(out);
  } catch (err) {
    console.error('[atelier] alt:', err.message);
    res.status(503).json({ error: err.message || 'The Atelier could not write the alt text — try again.' });
  }
});

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
