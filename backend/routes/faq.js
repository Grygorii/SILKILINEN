'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getFaq, saveFaq } = require('../services/faq');

// GET /api/faq — public list of Q&A for the storefront FAQ page.
router.get('/', function(req, res) {
  res.set('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400');
  res.json({ items: getFaq() });
});

// PUT /api/faq — admin; replace the whole list. Body: { items: [{ q, a }] }
router.put('/', requireAuth, async function(req, res) {
  try {
    res.json({ items: await saveFaq(req.body?.items) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
