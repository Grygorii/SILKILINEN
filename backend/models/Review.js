const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  // Core fields (existed pre-moderation)
  reviewer:     { type: String, required: true, trim: true, maxlength: 80 },
  message:      { type: String, default: '', trim: true, maxlength: 2000 },
  title:        { type: String, default: '', trim: true, maxlength: 120 },
  starRating:   { type: Number, required: true, min: 1, max: 5 },
  dateReviewed: { type: Date, default: Date.now },
  orderId:      { type: Number },     // legacy: numeric Etsy order id
  orderRefId:   { type: String, index: true, default: null }, // Mongo Order._id as string, set by /from-token submissions for dedup
  source:       { type: String, default: 'etsy' },
  helpfulCount: { type: Number, default: 0 },
  photos:       [String],

  // Legacy boolean — kept so old code paths still resolve. New code
  // should use `status` instead. Migration sets verified=true wherever
  // status was 'approved'.
  verified:     { type: Boolean, default: true },

  // ── Moderation pipeline ──────────────────────────────────────────────
  // Reviews submitted by customers start as 'pending' and only render
  // on the storefront once an admin moves them to 'approved'. Etsy
  // imports are bulk-set to 'approved' by the migration so nothing
  // disappears overnight.
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'spam'],
    default: 'pending',
    index: true,
  },
  // Reasons the auto-flag heuristics matched on submission. Empty
  // array = clean submission. Admin still has final say on every
  // review regardless of flags.
  flagReasons: [String],

  // ── Audit trail ──────────────────────────────────────────────────────
  ip:          { type: String },
  userAgent:   { type: String },
  moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  moderatedAt: { type: Date },
  rejectionReason: { type: String, default: '' },

  // ── Product link ─────────────────────────────────────────────────────
  // Optional. Brand-level Etsy reviews stay productId=null and continue
  // to appear in the general feed. Product-specific reviews carry the
  // productId so the PDP can filter and Google's Product schema can
  // emit aggregateRating per SKU.
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', index: true, default: null },

  // True when the reviewer's email matches a Customer who placed an
  // Order containing this product. Rendered as a "Verified buyer"
  // badge on the storefront card.
  verifiedPurchase: { type: Boolean, default: false },

  // ── Owner reply ──────────────────────────────────────────────────────
  // A public response from the shop, shown beneath the review on the
  // storefront ("Response from SILKILINEN"). Empty = no reply.
  reply:     { type: String, default: '', trim: true, maxlength: 1000 },
  repliedAt: { type: Date, default: null },
}, { timestamps: true });

// Compound index for the per-product PDP query (most common read path).
reviewSchema.index({ productId: 1, status: 1, dateReviewed: -1 });

module.exports = mongoose.model('Review', reviewSchema);
