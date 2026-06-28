const mongoose = require('mongoose');

// A visual page layout: an ordered list of content BLOCKS the founder arranges
// in the page builder. Each block is { id, type, props } — props is free-form per
// block type (heading text, image url, etc.). One layout per page slug.
//
// SAFETY: a page only renders from its layout when status is 'published'. Until
// then the storefront falls back to the existing hardcoded page, so building a
// homepage layout can never break the live homepage.
const blockSchema = new mongoose.Schema({
  id: { type: String, required: true },     // stable client id for keys/reorder
  type: { type: String, required: true },   // hero | heading | text | image | imageText | button | spacer
  props: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { _id: false });

const pageLayoutSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true }, // e.g. 'home'
  blocks: { type: [blockSchema], default: [] },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

module.exports = mongoose.model('PageLayout', pageLayoutSchema);
