'use strict';

// GET /api/admin/vercel-analytics — storefront traffic as Vercel counted it.
//
// Deliberately thin: every judgement about what the numbers MEAN (not enabled
// vs no traffic vs broken) is made in services/vercelAnalytics.js, so the
// dashboard tile and the advisor cannot disagree about the same reading.

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getTrafficCached } = require('../services/vercelAnalytics');

router.use(requireAuth);

router.get('/', async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 14, 1), 90);
  // getTrafficCached never throws — every failure is a named state in the body,
  // so the panel always has something honest to render.
  res.json(await getTrafficCached({ days }));
});

module.exports = router;
