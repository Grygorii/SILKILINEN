const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  label: { type: String, required: true, trim: true },
  description: { type: String, trim: true },

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
