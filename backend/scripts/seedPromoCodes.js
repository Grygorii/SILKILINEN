/**
 * Idempotent promo code seed script.
 * Safe to re-run — checks existence before creating.
 * Run: node backend/scripts/seedPromoCodes.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;
const PromoCode = require('../models/PromoCode');

const CODES_TO_SEED = [
  {
    code: 'SILK10',
    type: 'percentage',
    value: 10,
    minOrderValue: 0,
    maxUses: null,
    maxUsesPerCustomer: 1,
    active: true,
    status: 'active',
    redemptionType: 'single_use_per_customer',
    appliesTo: 'all',
    description: 'Newsletter welcome — 10% off, one use per customer',
    source: 'newsletter_welcome',
  },
];

async function createStripeCode(promo) {
  if (!stripe) {
    console.log(`  [stripe] STRIPE_SECRET_KEY not set — skipping Stripe sync for ${promo.code}`);
    return { stripeCouponId: null, stripePromotionCodeId: null };
  }
  try {
    const couponParams = promo.type === 'percentage'
      ? { percent_off: promo.value, duration: 'once' }
      : { amount_off: Math.round(promo.value * 100), currency: 'eur', duration: 'once' };
    const coupon = await stripe.coupons.create(couponParams);
    const stripePromo = await stripe.promotionCodes.create({ coupon: coupon.id, code: promo.code });
    console.log(`  [stripe] Coupon ${coupon.id} created, promo code ${stripePromo.id}`);
    return { stripeCouponId: coupon.id, stripePromotionCodeId: stripePromo.id };
  } catch (err) {
    // Common: code already exists in Stripe on a re-run
    console.warn(`  [stripe] Failed (may already exist): ${err.message}`);
    return { stripeCouponId: null, stripePromotionCodeId: null };
  }
}

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  for (const def of CODES_TO_SEED) {
    const existing = await PromoCode.findOne({ code: def.code });
    if (existing) {
      // Ensure status field is set if it was created before the extension
      if (!existing.status) {
        existing.status = existing.active ? 'active' : 'paused';
        existing.redemptionType = existing.redemptionType || 'single_use_per_customer';
        existing.appliesTo = existing.appliesTo || 'all';
        existing.source = existing.source || def.source;
        await existing.save();
        console.log(`${def.code}: exists — migrated status/redemptionType fields`);
      } else {
        console.log(`${def.code}: exists and up to date — skipping`);
      }
      continue;
    }

    console.log(`${def.code}: creating…`);
    const { stripeCouponId, stripePromotionCodeId } = await createStripeCode(def);
    await PromoCode.create({ ...def, stripeCouponId, stripePromotionCodeId });
    console.log(`${def.code}: created ✓`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch(err => { console.error(err); process.exit(1); });
