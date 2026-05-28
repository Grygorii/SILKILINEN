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

  // Extended fields (added for richer admin UX — backward compatible, all optional)
  status: { type: String, enum: ['active', 'paused', 'expired', 'draft', 'archived'], default: null },
  redemptionType: { type: String, enum: ['single_use_per_customer', 'unlimited', 'capped_total'], default: null },
  appliesTo: { type: String, enum: ['all', 'specific_products', 'specific_collections'], default: 'all' },
  source: { type: String, default: '' },
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', default: null },
  // Personal codes — linked directly to a specific customer
  targetCustomerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
}, { timestamps: true });

// Virtual: resolve effective active state from both `active` and `status` fields.
// `status` wins if set; otherwise fall back to the old boolean `active`.
promoCodeSchema.virtual('isActive').get(function () {
  if (this.status) return this.status === 'active';
  return this.active;
});

module.exports = mongoose.model('PromoCode', promoCodeSchema);
