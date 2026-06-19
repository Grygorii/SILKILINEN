const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { aiLimit } = require('../middleware/rateLimiters');
const { generatePins, listArticles } = require('../services/pinStudio');

// GET /api/admin/pin-studio/articles — articles to turn into pins.
router.get('/articles', requireAuth, async function(req, res) {
  try {
    res.json({ articles: await listArticles() });
  } catch (err) {
    console.error('[pin-studio] articles:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/pin-studio/generate { articleId } — 3 ready-to-post pins.
router.post('/generate', requireAuth, aiLimit, async function(req, res) {
  try {
    const { articleId } = req.body || {};
    if (!articleId) return res.status(400).json({ error: 'articleId required' });
    const result = await generatePins(articleId);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[pin-studio] generate:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
