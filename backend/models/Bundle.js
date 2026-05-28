const mongoose = require('mongoose');

const bundleProductSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  displayOrder: { type: Number, default: 0 },
}, { _id: false });

const bundleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  description: { type: String, trim: true },

  heroImage: {
    url: { type: String },
    cloudinaryPublicId: { type: String },
    alt: { type: String },
  },

  // Products included in the bundle. Each child keeps its own price in the
  // Product collection; the bundle just references them and applies a single
  // discountPercent on top of the sum. Pricing is computed at read time via
  // computePricing() — never denormalised — so changing a child product's
  // price flows through automatically.
  products: { type: [bundleProductSchema], default: [] },

  // 0-100. e.g. 10 = 10% off the sum of included product prices.
  discountPercent: { type: Number, required: true, min: 0, max: 100, default: 0 },

  isFeatured: { type: Boolean, default: false },
  featuredOrder: { type: Number },
  displayOrder: { type: Number, default: 0 },

  status: {
    type: String,
    enum: ['active', 'draft', 'archived'],
    default: 'draft',
  },

  metaTitle: { type: String, maxlength: 70 },
  metaDescription: { type: String, maxlength: 165 },
}, { timestamps: true });

// `slug` already has a unique index from `unique: true` above — don't redeclare.
bundleSchema.index({ status: 1, displayOrder: 1 });
bundleSchema.index({ isFeatured: 1, featuredOrder: 1 });

/**
 * Compute pricing from a populated product list + discount.
 * Returns rounded-to-cents values so the UI / Stripe never see fractional cents.
 *
 *   products: Array<{ price: number }> (whatever shape, must have .price)
 *   discountPercent: number 0-100
 */
bundleSchema.statics.computePricing = function(products, discountPercent) {
  const pct = Math.max(0, Math.min(100, Number(discountPercent) || 0));
  const originalTotal = products.reduce((s, p) => s + (Number(p?.price) || 0), 0);
  const bundlePrice = originalTotal * (1 - pct / 100);
  const round = (n) => Math.round(n * 100) / 100;
  return {
    originalTotal: round(originalTotal),
    bundlePrice: round(bundlePrice),
    savings: round(originalTotal - bundlePrice),
    discountPercent: pct,
  };
};

module.exports = mongoose.model('Bundle', bundleSchema);
