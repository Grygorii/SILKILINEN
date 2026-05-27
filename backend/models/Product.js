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
  // Schema-level defence in depth. routes/adminProducts.js validateForSave()
  // already enforces these for admin writes, but anything that bypasses the
  // route (seed scripts, migrations, direct Mongoose) used to be able to
  // create nameless or zero-price products.
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    validate: {
      validator: v => typeof v === 'string' && v.trim().length > 0,
      message: 'Product name cannot be empty',
    },
  },

  status: {
    type: String,
    enum: ['draft', 'active', 'sold_out', 'archived'],
    default: 'draft',
    index: true,
  },

  // Design-system v1 "NEW" badge — manual flag, admin controlled.
  // Show as a warm-beige uppercase pill on the PDP and shop card when true.
  isNew: { type: Boolean, default: false },

  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative'],
  },
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

  // Collections — replaces/supplements the single `category` field
  collections: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Collection' }],

  // Color — used for cross-product variant linking (single colour per product model)
  colorName: { type: String },
  colorHex: { type: String },
  colorVariants: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    colorName: { type: String },
    _id: false,
  }],

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

  costing: {
    materialCost:   { type: Number },
    laborCost:      { type: Number },
    packagingCost:  { type: Number },
    totalUnitCost:  { type: Number },
    notes:          { type: String },
    lastUpdated:    { type: Date },
    updatedBy:      { type: String },
  },
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
