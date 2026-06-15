'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getSizeChart, saveSizeChart } = require('../services/sizeChart');

// GET /api/size-chart — public measurement rows for the size-guide page.
router.get('/', function(req, res) {
  res.set('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400');
  res.json({ rows: getSizeChart() });
});

// PUT /api/size-chart — admin; replace the table. Body: { rows: [...] }
router.put('/', requireAuth, async function(req, res) {
  try {
    res.json({ rows: await saveSizeChart(req.body?.rows) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
