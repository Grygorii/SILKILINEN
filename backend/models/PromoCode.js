const mongoose = require('mongoose');

const promoCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  type: { type: String, enum: ['percentage', 'fixed'], required: true },
  value: { type: Number, required: true },
  minOrderValue: { type: Number, default: 0 },
  maxUses: { type: Number, default: null },
  maxUsesPerCustomer: { type: Number, default: 1 },
  validFrom: { type: Date, default: Date.now },
  validUntil: { type: Date, default: null },
  active: { type: Boolean, default: true },
  description: { type: String, default: '' },
  usageCount: { type: Number, default: 0 },
  stripeCouponId: { type: String, default: null },
  stripePromotionCodeId: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('PromoCode', promoCodeSchema);
