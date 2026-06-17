const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getConnections } = require('../services/connections');

let cache = null, cacheAt = 0;
const TTL = 5 * 60 * 1000;

router.get('/', requireAuth, async (req, res) => {
  const force = req.query.force === 'true';
  if (!force && cache && Date.now() - cacheAt < TTL) return res.json({ ...cache, cached: true });
  try {
    const data = await getConnections();
    cache = data; cacheAt = Date.now();
    res.json({ ...data, cached: false });
  } catch (err) {
    console.error('[connections]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
