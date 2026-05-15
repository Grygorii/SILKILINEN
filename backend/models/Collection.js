const mongoose = require('mongoose');

const collectionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  description: { type: String, trim: true },

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

collectionSchema.index({ slug: 1 });
collectionSchema.index({ status: 1, displayOrder: 1 });
collectionSchema.index({ isFeatured: 1, featuredOrder: 1 });

module.exports = mongoose.model('Collection', collectionSchema);
