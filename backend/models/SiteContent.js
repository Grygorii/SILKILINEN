const mongoose = require('mongoose');

const siteContentSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, trim: true },
  type: { type: String, enum: ['image', 'text', 'richtext', 'url'], required: true },
  value: { type: String, default: '' },
  altText: { type: String, default: '' },
  caption: { type: String, default: '' },
  section: { type: String, required: true },
  label: { type: String, required: true },
  order: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

module.exports = mongoose.model('SiteContent', siteContentSchema);
