const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { buildRecommendations } = require('../services/advisor');
const { runAdvisorDigest } = require('../services/advisorDigest');

// The Advisor. The SEO/Merchant health panel answers "is anything broken?";
// this answers "what should I do next to grow?". Logic lives in
// services/advisor.js so the dashboard route and the weekly email digest share
// one source of truth.

let cache = null;
let cacheAt = 0;
const CACHE_TTL = 60 * 60 * 1000;

router.get('/', requireAuth, async (req, res) => {
  const now = Date.now();
  const force = req.query.force === 'true';
  if (!force && cache && now - cacheAt < CACHE_TTL) {
    return res.json({ ...cache, cached: true });
  }
  try {
    const recommendations = await buildRecommendations();
    const payload = { generatedAt: new Date().toISOString(), recommendations };
    cache = payload;
    cacheAt = now;
    res.json({ ...payload, cached: false });
  } catch (err) {
    console.error('[advisor]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send the weekly digest right now, ignoring the cadence — lets the founder
// confirm the email works without waiting a week. Reports why it didn't send
// (e.g. email not configured) so it's not a silent no-op.
router.post('/send-test', requireAuth, async (req, res) => {
  try {
    const result = await runAdvisorDigest({ force: true });
    res.json(result);
  } catch (err) {
    console.error('[advisor] test digest', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
