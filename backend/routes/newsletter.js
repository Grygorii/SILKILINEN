const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Newsletter = require('../models/Newsletter');
const PromoCode = require('../models/PromoCode');
const { sendNewsletterWelcome } = require('../services/email');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FRONTEND = process.env.FRONTEND_URL || 'https://silkilinen.com';

function generateUniqueCode() {
  return 'SILK' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

async function handleSubscribe(req, res) {
  const { email, source = 'website' } = req.body;
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const normalised = email.toLowerCase().trim();

  // Return success silently if already subscribed (don't expose data)
  const existing = await Newsletter.findOne({ email: normalised });
  if (existing && !existing.isUnsubscribed) {
    return res.json({ success: true });
  }

  const code = generateUniqueCode();
  const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  try {
    // Create promo code in DB
    await PromoCode.create({
      code,
      type: 'percentage',
      value: 10,
      maxUses: 1,
      maxUsesPerCustomer: 1,
      validUntil,
      active: true,
      description: `Newsletter welcome — ${normalised}`,
    });

    // Upsert newsletter record
    await Newsletter.findOneAndUpdate(
      { email: normalised },
      {
        email: normalised,
        source,
        subscribedAt: new Date(),
        discountCodeIssued: code,
        discountCodeUsed: false,
        isUnsubscribed: false,
      },
      { upsert: true, new: true }
    );

    await sendNewsletterWelcome({ email: normalised, code, validUntil, unsubscribeToken: null });

    return res.json({ success: true });
  } catch (err) {
    // If RESEND or DB is not configured, still acknowledge
    console.error('Newsletter subscribe error:', err.message);
    return res.json({ success: true });
  }
}

// Root POST — backward compat with NewsletterBand which posts to /api/newsletter
router.post('/', handleSubscribe);
router.post('/subscribe', handleSubscribe);

// GET /api/newsletter/unsubscribe/:token
router.get('/unsubscribe/:token', async function(req, res) {
  try {
    const record = await Newsletter.findOneAndUpdate(
      { unsubscribeToken: req.params.token },
      { isUnsubscribed: true },
      { new: true }
    );
    if (!record) {
      return res.redirect(`${FRONTEND}/?unsubscribe=notfound`);
    }
    res.redirect(`${FRONTEND}/?unsubscribe=success`);
  } catch (err) {
    res.redirect(`${FRONTEND}/?unsubscribe=error`);
  }
});

module.exports = router;
