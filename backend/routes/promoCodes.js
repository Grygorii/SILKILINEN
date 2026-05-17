const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const PromoCode = require('../models/PromoCode');
const PromoCodeRedemption = require('../models/PromoCodeRedemption');
const Order = require('../models/Order');
const { requireAuth } = require('../middleware/auth');

// GET /api/promo-codes
router.get('/', requireAuth, async function(req, res) {
  try {
    const filter = {};
    if (req.query.status && req.query.status !== 'all') {
      if (req.query.status === 'active') {
        // Match either status field or legacy active boolean
        filter.$or = [{ status: 'active' }, { status: null, active: true }];
      } else if (req.query.status === 'paused' || req.query.status === 'expired' || req.query.status === 'draft') {
        filter.$or = [{ status: req.query.status }, { status: null, active: false }];
      }
    }
    if (req.query.search) {
      filter.code = { $regex: req.query.search.toUpperCase(), $options: 'i' };
    }
    const codes = await PromoCode.find(filter).sort({ createdAt: -1 });
    res.json(codes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/promo-codes/:id
router.get('/:id', requireAuth, async function(req, res) {
  try {
    const promo = await PromoCode.findById(req.params.id);
    if (!promo) return res.status(404).json({ error: 'Not found' });

    // Performance metrics
    const redemptions = await PromoCodeRedemption.find({ promoCodeId: promo._id }).sort({ redeemedAt: -1 }).lean();
    const orderIds = redemptions.map(r => r.orderId).filter(Boolean);
    const orders = orderIds.length > 0
      ? await Order.find({ _id: { $in: orderIds } }, 'total orderNumber customerEmail createdAt status').lean()
      : [];

    const totalDiscountGiven = redemptions.reduce((s, r) => s + (r.discountAmount || 0), 0);
    const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);
    const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : null;

    const orderMap = Object.fromEntries(orders.map(o => [String(o._id), o]));
    const redemptionRows = redemptions.slice(0, 50).map(r => ({
      _id:           r._id,
      orderNumber:   r.orderNumber || orderMap[String(r.orderId)]?.orderNumber || '—',
      orderId:       r.orderId,
      customerEmail: r.customerEmail,
      discountAmount: r.discountAmount,
      redeemedAt:    r.redeemedAt,
      orderStatus:   orderMap[String(r.orderId)]?.status,
    }));

    res.json({
      ...promo.toObject(),
      performance: {
        totalRedemptions: redemptions.length,
        totalDiscountGiven,
        totalRevenue,
        avgOrderValue,
      },
      redemptions: redemptionRows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/promo-codes — creates code in DB + Stripe
router.post('/', requireAuth, async function(req, res) {
  try {
    const {
      code, type, value, minOrderValue, maxUses, maxUsesPerCustomer,
      validFrom, validUntil, active, description,
      status, redemptionType, appliesTo, source, campaignId,
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

    const effectiveStatus = status || (active !== false ? 'active' : 'paused');
    const promo = await PromoCode.create({
      code: code.toUpperCase(),
      type,
      value,
      minOrderValue: minOrderValue || 0,
      maxUses: maxUses || null,
      maxUsesPerCustomer: maxUsesPerCustomer || 1,
      validFrom: validFrom || new Date(),
      validUntil: validUntil || null,
      active: effectiveStatus === 'active',
      status: effectiveStatus,
      description: description || '',
      redemptionType: redemptionType || null,
      appliesTo: appliesTo || 'all',
      source: source || '',
      campaignId: campaignId || null,
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
    const allowed = [
      'type', 'value', 'minOrderValue', 'maxUses', 'maxUsesPerCustomer',
      'validFrom', 'validUntil', 'active', 'description',
      'status', 'redemptionType', 'appliesTo', 'source', 'campaignId',
    ];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    // Keep active in sync with status
    if (update.status) update.active = update.status === 'active';
    if ('active' in req.body && !update.status) {
      update.status = req.body.active ? 'active' : 'paused';
    }

    const promo = await PromoCode.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!promo) return res.status(404).json({ error: 'Not found' });
    res.json(promo);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/promo-codes/:id — soft deactivate, archives in Stripe
router.delete('/:id', requireAuth, async function(req, res) {
  try {
    const promo = await PromoCode.findById(req.params.id);
    if (!promo) return res.status(404).json({ error: 'Not found' });

    promo.active = false;
    promo.status = 'expired';
    await promo.save();

    if (promo.stripeCouponId && process.env.STRIPE_SECRET_KEY) {
      try { await stripe.coupons.del(promo.stripeCouponId); } catch {}
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
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
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
