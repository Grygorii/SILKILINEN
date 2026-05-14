const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;
const { SLOT_KEYS } = require('../config/imageSlots');
const { SLUGS: CATEGORY_SLUGS } = require('../config/categories');

const variantSchema = new mongoose.Schema({
  sku: { type: String },
  colour: { type: String },
  size: { type: String },
  stockLevel: { type: Number, default: 0, min: 0 },
  lowStockThreshold: { type: Number, default: 3 },
  barcode: { type: String },
  weight: { type: Number },
}, { _id: true });

const imageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  alt: { type: String, default: '' },
  isPrimary: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
  associatedColour: { type: String },
  cloudinaryPublicId: { type: String },
  slot: { type: String, enum: SLOT_KEYS },
}, { _id: true });

const productVideoSchema = new mongoose.Schema({
  url:                { type: String, required: true },
  thumbnailUrl:       { type: String },
  cloudinaryPublicId: { type: String },
}, { _id: false });

const productSchema = new mongoose.Schema({
  // required: false — application-level validation via validateForSave() / validateForPublish()
  // handles required-on-save and required-on-publish checks. Schema required: true would
  // block empty draft creation.
  name: { type: String, required: false, default: '', trim: true },

  status: {
    type: String,
    enum: ['draft', 'active', 'sold_out', 'archived'],
    default: 'draft',
    index: true,
  },

  price: { type: Number, required: false, default: 0, min: 0 },
  compareAtPrice: { type: Number, min: 0 },
  costPrice: { type: Number, min: 0 },

  category: { type: String, required: false, trim: true, enum: CATEGORY_SLUGS, default: CATEGORY_SLUGS[0] },
  description: { type: String, trim: true },
  tags: [String],

  variants: [variantSchema],

  // Auto-derived from variants in pre-save
  colours: [String],
  sizes: [String],
  totalStock: { type: Number, default: 0 },
  inStock: { type: Boolean, default: true },

  images: [imageSchema],
  productVideo: productVideoSchema,

  // Legacy fields — kept for backwards compat, synced from images[] in pre-save
  image: { type: String },
  altText: { type: String },
  stockLevel: { type: Number, default: null },

  metaTitle: { type: String, maxlength: 70 },
  metaDescription: { type: String, maxlength: 165 },
  slug: { type: String, sparse: true },
  keywords: [String],
  altTextTemplate: { type: String, default: '' },

  materialComposition: { type: String },
  careInstructions: { type: String },
  origin: { type: String, default: 'Made in Donegal' },
  certifications: [String],

  lastUpdatedBy: { type: ObjectId, ref: 'User' },
}, { timestamps: true });

productSchema.index({ status: 1, category: 1 });
productSchema.index({ status: 1, createdAt: -1 });
productSchema.index({ slug: 1 }, { unique: true, sparse: true });

productSchema.pre('save', async function() {
  this.colours = [...new Set(this.variants.map(v => v.colour).filter(Boolean))];
  this.sizes = [...new Set(this.variants.map(v => v.size).filter(Boolean))];

  this.totalStock = this.variants.reduce((sum, v) => sum + (v.stockLevel || 0), 0);
  this.inStock = this.totalStock > 0;

  if (this.status === 'active' && this.totalStock === 0 && this.variants.length > 0) {
    this.status = 'sold_out';
  }

  if (!this.slug && this.name) {
    this.slug = this.name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  // Sync legacy image field from images array
  if (this.images.length > 0) {
    const primary = this.images.find(img => img.isPrimary) || this.images[0];
    this.image = primary.url;
    if (primary.alt) this.altText = primary.alt;
  }
});

module.exports = mongoose.model('Product', productSchema);
