const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const PromoCode = require('../models/PromoCode');
const { requireAuth } = require('../middleware/auth');

// GET /api/promo-codes
router.get('/', requireAuth, async function(req, res) {
  try {
    const codes = await PromoCode.find().sort({ createdAt: -1 });
    res.json(codes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/promo-codes — creates code in DB + Stripe
router.post('/', requireAuth, async function(req, res) {
  try {
    const {
      code, type, value, minOrderValue, maxUses, maxUsesPerCustomer,
      validFrom, validUntil, active, description,
    } = req.body;

    let stripeCouponId = null;
    let stripePromotionCodeId = null;

    if (process.env.STRIPE_SECRET_KEY) {
      try {
        const couponParams = type === 'percentage'
          ? { percent_off: value, duration: 'once' }
          : { amount_off: Math.round(value * 100), currency: 'eur', duration: 'once' };

        const coupon = await stripe.coupons.create(couponParams);
        stripeCouponId = coupon.id;

        const promoParams = { coupon: coupon.id, code: code.toUpperCase() };
        if (maxUses) promoParams.max_redemptions = Number(maxUses);
        if (validUntil) promoParams.expires_at = Math.floor(new Date(validUntil).getTime() / 1000);

        const stripePromo = await stripe.promotionCodes.create(promoParams);
        stripePromotionCodeId = stripePromo.id;
      } catch (stripeErr) {
        console.error('Stripe promo code creation failed:', stripeErr.message);
      }
    }

    const promo = await PromoCode.create({
      code: code.toUpperCase(),
      type,
      value,
      minOrderValue: minOrderValue || 0,
      maxUses: maxUses || null,
      maxUsesPerCustomer: maxUsesPerCustomer || 1,
      validFrom: validFrom || new Date(),
      validUntil: validUntil || null,
      active: active !== false,
      description: description || '',
      stripeCouponId,
      stripePromotionCodeId,
    });

    res.json(promo);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/promo-codes/:id
router.put('/:id', requireAuth, async function(req, res) {
  try {
    const promo = await PromoCode.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!promo) return res.status(404).json({ error: 'Not found' });
    res.json(promo);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/promo-codes/:id — soft delete, archives in Stripe
router.delete('/:id', requireAuth, async function(req, res) {
  try {
    const promo = await PromoCode.findById(req.params.id);
    if (!promo) return res.status(404).json({ error: 'Not found' });

    promo.active = false;
    await promo.save();

    if (promo.stripeCouponId && process.env.STRIPE_SECRET_KEY) {
      try { await stripe.coupons.del(promo.stripeCouponId); } catch {}
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/promo-codes/:id/sync-stripe — re-sync with Stripe
router.post('/:id/sync-stripe', requireAuth, async function(req, res) {
  try {
    const promo = await PromoCode.findById(req.params.id);
    if (!promo) return res.status(404).json({ error: 'Not found' });

    const couponParams = promo.type === 'percentage'
      ? { percent_off: promo.value, duration: 'once' }
      : { amount_off: Math.round(promo.value * 100), currency: 'eur', duration: 'once' };

    const coupon = await stripe.coupons.create(couponParams);
    const promoParams = { coupon: coupon.id, code: promo.code };
    if (promo.maxUses) promoParams.max_redemptions = promo.maxUses;
    if (promo.validUntil) promoParams.expires_at = Math.floor(new Date(promo.validUntil).getTime() / 1000);

    const stripePromo = await stripe.promotionCodes.create(promoParams);
    promo.stripeCouponId = coupon.id;
    promo.stripePromotionCodeId = stripePromo.id;
    await promo.save();

    res.json(promo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
