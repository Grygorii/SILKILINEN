require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const PromoCode = require('../models/PromoCode');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const existing = await PromoCode.findOne({ code: 'SILK10' });
  if (existing) {
    console.log('SILK10 already exists — skipping');
    await mongoose.disconnect();
    return;
  }

  let stripeCouponId = null;
  let stripePromotionCodeId = null;

  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const coupon = await stripe.coupons.create({ percent_off: 10, duration: 'once' });
      stripeCouponId = coupon.id;
      const stripePromo = await stripe.promotionCodes.create({ coupon: coupon.id, code: 'SILK10' });
      stripePromotionCodeId = stripePromo.id;
      console.log('Stripe coupon created:', coupon.id);
    } catch (err) {
      console.error('Stripe creation failed (code may already exist):', err.message);
    }
  }

  await PromoCode.create({
    code: 'SILK10',
    type: 'percentage',
    value: 10,
    minOrderValue: 0,
    maxUses: null,
    maxUsesPerCustomer: 1,
    active: true,
    description: 'Welcome discount — 10% off, one use per customer',
    stripeCouponId,
    stripePromotionCodeId,
  });

  console.log('SILK10 promo code created');
  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
