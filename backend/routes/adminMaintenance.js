const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const Visit = require('../models/Visit');
const Order = require('../models/Order');

router.use(requireAuth);

// Cities that are Google/AWS crawler data centres, not shoppers. Historical
// bot visits were recorded before the User-Agent filter existed (the tracking
// proxy now drops them at the door); they sit in the 30-day window inflating
// "Direct" traffic and crushing the conversion rate. Sessions that actually
// placed an order are never touched.
const DATA_CENTRE_CITIES = [
  'San Jose', 'Mountain View', 'The Dalles', 'Council Bluffs',
  'Ashburn', 'Boardman', 'Columbus', 'Santa Clara',
];

async function botFilter() {
  // Exclude any session that ever converted — a real person.
  const buyerSessions = await Order.distinct('browserSessionId', { browserSessionId: { $ne: null } });
  return {
    city: { $in: DATA_CENTRE_CITIES },
    source: 'direct',
    sessionId: { $nin: buyerSessions },
  };
}

// GET /api/admin/maintenance/bot-visits — preview how many would be removed.
router.get('/bot-visits', async function(req, res) {
  try {
    const filter = await botFilter();
    const [count, total] = await Promise.all([
      Visit.countDocuments(filter),
      Visit.estimatedDocumentCount(),
    ]);
    res.json({ count, total, cities: DATA_CENTRE_CITIES });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/maintenance/purge-bot-visits — delete them.
router.post('/purge-bot-visits', async function(req, res) {
  try {
    const filter = await botFilter();
    const result = await Visit.deleteMany(filter);
    res.json({ ok: true, deleted: result.deletedCount });
  } catch (err) {
    console.error('[maintenance] purge error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
