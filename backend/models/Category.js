const mongoose = require('mongoose');
const { slugify } = require('../utils/slug');

const categorySchema = new mongoose.Schema({
  // Normalised by the pre('save') hook below — `lowercase/trim` alone would let
  // spaces and punctuation straight into the /shop?category=<slug> URL.
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

// Normalise only when the slug is new or deliberately changed — NOT on every
// save. Unlike Collection, a category slug is also the string stored on
// Product.category, and there's no previousSlugs here to redirect from, so
// silently re-slugging during an unrelated save (a displayOrder tweak, say)
// could orphan every product pointing at the old value. Existing malformed
// slugs are left for scripts/fixCollectionSlugs.js to report and fix
// deliberately.
categorySchema.pre('save', function() {
  if (this.slug && (this.isNew || this.isModified('slug'))) this.slug = slugify(this.slug);
});

// `slug` already has a unique index from `unique: true` above — don't redeclare.
categorySchema.index({ status: 1, displayOrder: 1 });

module.exports = mongoose.model('Category', categorySchema);
