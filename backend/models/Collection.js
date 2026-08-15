const mongoose = require('mongoose');
const { slugify } = require('../utils/slug');

const collectionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  // Old slugs kept so a changed URL 301-redirects instead of 404ing (same
  // contract as Product.previousSlugs).
  previousSlugs: { type: [String], default: [] },
  description: { type: String, trim: true },

  // Collection-wide sale: every product in this collection sells at this % off
  // while the collection is active. Applied authoritatively at checkout and
  // shown on the storefront. 0 = no discount.
  discountPercent: { type: Number, default: 0, min: 0, max: 90 },

  heroImage: {
    url: { type: String },
    cloudinaryPublicId: { type: String },
    alt: { type: String },
  },

  isFeatured: { type: Boolean, default: false },
  featuredOrder: { type: Number },
  displayOrder: { type: Number, default: 0 },

  status: {
    type: String,
    enum: ['active', 'draft', 'archived'],
    default: 'active',
  },

  metaTitle: { type: String, maxlength: 70 },
  metaDescription: { type: String, maxlength: 165 },
}, { timestamps: true });

// Slug is normalised HERE, not in the routes, so every write path — admin,
// seeds, scripts, agents — gets the same URL-safe result. `lowercase/trim`
// alone let a whole sentence through: one collection shipped as
// /collections/a%20curated%20edit%20of%20silk%20robe,%20nightshirt,...
// Mirrors Product's hook: derive from name when absent, slugify, remember the
// old slug for redirects, and break uniqueness ties with -2, -3…
collectionSchema.pre('save', async function() {
  if (!this.slug && this.name) this.slug = this.name;
  if (!this.slug) return;

  this.slug = slugify(this.slug);
  if (!this.isNew && this.isModified('slug')) {
    const prev = await this.constructor.findById(this._id).select('slug').lean();
    if (prev?.slug && prev.slug !== this.slug) {
      this.previousSlugs = [...new Set([...(this.previousSlugs || []), prev.slug])];
    }
  }

  const base = this.slug;
  let n = 2;
  while (await this.constructor.exists({ slug: this.slug, _id: { $ne: this._id } })) {
    this.slug = `${base}-${n++}`;
  }
  // Never keep the live slug in the redirect history.
  if (this.previousSlugs?.length) this.previousSlugs = this.previousSlugs.filter(s => s !== this.slug);
});

collectionSchema.index({ slug: 1 });
collectionSchema.index({ previousSlugs: 1 });
collectionSchema.index({ status: 1, displayOrder: 1 });
collectionSchema.index({ isFeatured: 1, featuredOrder: 1 });

module.exports = mongoose.model('Collection', collectionSchema);
