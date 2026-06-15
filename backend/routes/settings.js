'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getSiteSettings, saveSiteSettings } = require('../services/siteSettings');

// GET /api/settings — public; the storefront reads the editable site settings
// (welcome offer, business details). All fields are public by design.
router.get('/', function(req, res) {
  res.set('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400');
  res.json(getSiteSettings());
});

// PUT /api/settings — admin only; edit the settings.
router.put('/', requireAuth, async function(req, res) {
  try {
    res.json(await saveSiteSettings(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
