const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  label: { type: String, required: true, trim: true },
  description: { type: String, trim: true },

  // Search-engine snippet for this category's /shop?category=<slug> view.
  // Generated (approve-first) by the shared SEO writer; falls back to label/
  // description on the storefront when unset.
  metaTitle: { type: String, maxlength: 70, trim: true },
  metaDescription: { type: String, maxlength: 165, trim: true },

  heroImage: {
    url: { type: String },
    cloudinaryPublicId: { type: String },
    alt: { type: String },
  },

  displayOrder: { type: Number, default: 0 },

  status: {
    type: String,
    enum: ['active', 'archived'],
    default: 'active',
  },
}, { timestamps: true });

// `slug` already has a unique index from `unique: true` above — don't redeclare.
categorySchema.index({ status: 1, displayOrder: 1 });

module.exports = mongoose.model('Category', categorySchema);
