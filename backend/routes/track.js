const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const Visit = require('../models/Visit');

const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/visit', trackLimiter, async function(req, res) {
  // Always respond 200 — tracking never breaks the customer experience
  try {
    const { sessionId, page, productId, utm, referrer, device, source } = req.body;
    if (sessionId && page) {
      await Visit.create({
        sessionId,
        page,
        productId: productId || undefined,
        source: source || 'direct',
        utm: utm || {},
        referrer: referrer || undefined,
        device: device || 'unknown',
      });
    }
  } catch (err) {
    console.error('[track] visit error:', err.message);
  }
  res.json({ ok: true });
});

module.exports = router;
