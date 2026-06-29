const express = require('express');
const router = express.Router();
const { getRates, SUPPORTED } = require('../services/exchangeRates');

// GET /api/rates — EUR-base rates + the currencies the storefront can switch to.
// Public; the frontend caches it and converts displayed prices client-side.
router.get('/', async (req, res) => {
  try {
    const rates = await getRates();
    const currencies = Object.entries(SUPPORTED).map(([code, c]) => ({ code, symbol: c.symbol, label: c.label }));
    res.json({ base: 'EUR', rates, currencies });
  } catch (err) {
    console.error('[rates] endpoint:', err.message);
    res.json({
      base: 'EUR',
      rates: { EUR: 1, GBP: 0.84, USD: 1.08 },
      currencies: Object.entries(SUPPORTED).map(([code, c]) => ({ code, symbol: c.symbol, label: c.label })),
    });
  }
});

module.exports = router;
