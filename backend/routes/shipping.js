'use strict';

const express = require('express');
const router = express.Router();
const { getEffectiveRates } = require('../services/shipping');

// Public shipping rates for the storefront shipping page. Reads the SAME source
// as checkout (services/shipping.js — defaults + admin overrides), so the page
// can never contradict the live rates again. Numbers only; the page keeps its
// own editorial copy.
router.get('/', function(req, res) {
  const tiers = getEffectiveRates().map(t => ({
    label: t.label,
    cost: t.effective.cost,
    freeThreshold: t.effective.freeThreshold,
    deliveryMin: t.effective.deliveryMin,
    deliveryMax: t.effective.deliveryMax,
  }));
  res.set('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400');
  res.json({ tiers });
});

module.exports = router;
