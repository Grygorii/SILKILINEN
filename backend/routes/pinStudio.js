const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { aiLimit } = require('../middleware/rateLimiters');
const { generatePins, listSources, socialTraffic } = require('../services/pinStudio');

// GET /api/admin/pin-studio/sources — the raw material (articles, products, reviews).
router.get('/sources', requireAuth, async function(req, res) {
  try {
    res.json(await listSources());
  } catch (err) {
    console.error('[pin-studio] sources:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/pin-studio/traffic — what the tracked pins actually drove (30d).
router.get('/traffic', requireAuth, async function(req, res) {
  try {
    res.json(await socialTraffic());
  } catch (err) {
    console.error('[pin-studio] traffic:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/pin-studio/generate { type, id } — 3 ready-to-post pins.
router.post('/generate', requireAuth, aiLimit, async function(req, res) {
  try {
    const { type, id } = req.body || {};
    if (!id || !['article', 'product', 'review'].includes(type)) {
      return res.status(400).json({ error: 'type (article|product|review) and id required' });
    }
    const result = await generatePins({ type, id });
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[pin-studio] generate:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
