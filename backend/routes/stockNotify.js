'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const StockNotification = require('../models/StockNotification');
const Product = require('../models/Product');

const router = express.Router();

// Tighter than the global floor: this endpoint writes a row per call and takes
// an email address, so it is the sort of thing worth abusing.
const notifyLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again shortly.' },
});

// Same conservative shape the checkout uses — must be local@domain.tld with a
// real TLD, so "foo@bar" and "foo@bar." are rejected rather than stored as
// permanently unreachable rows.
const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

// POST /api/stock-notify — join the waitlist for a sold-out piece.
router.post('/', notifyLimit, async function (req, res) {
  try {
    const { productId, email, size, colour } = req.body || {};
    if (!productId || typeof email !== 'string' || !VALID_EMAIL.test(email.trim())) {
      return res.status(400).json({ error: 'A product and a valid email address are required.' });
    }

    const product = await Product.findById(productId).select('_id name').lean();
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Upsert on the unique partial index, so clicking twice is idempotent
    // rather than a duplicate-key error shown to a customer.
    await StockNotification.updateOne(
      {
        product: product._id,
        email: email.trim().toLowerCase(),
        size: String(size || ''),
        colour: String(colour || ''),
        notifiedAt: null,
      },
      { $setOnInsert: { createdAt: new Date() } },
      { upsert: true },
    );

    res.json({ ok: true, message: `We'll email you when ${product.name} is back.` });
  } catch (err) {
    // A duplicate key here means they are already on the list, which from the
    // customer's point of view is success, not an error.
    if (err.code === 11000) return res.json({ ok: true, message: "You're already on the list." });
    console.error('[stockNotify] join failed:', err.message);
    res.status(500).json({ error: 'Could not add you to the list. Please try again.' });
  }
});

module.exports = router;
