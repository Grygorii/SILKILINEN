'use strict';

const mongoose = require('mongoose');

// Per-resource, per-locale translation store — the same shape Shopify's
// Translate & Adapt uses: keyed by (resourceType, resourceId, locale), holding a
// flexible { field -> translated text } object. Content (products, categories,
// collections, journal, static pages) is translated ONCE into this store and
// read at render time; nothing is translated on-the-fly per request. `source`
// records whether a value is AI-written or founder-edited so a re-run never
// clobbers a manual override.
const translationSchema = new mongoose.Schema({
  resourceType: { type: String, enum: ['product', 'category', 'collection', 'article', 'page', 'ui'], required: true },
  resourceId: { type: String, required: true },        // entity _id, or a path/key for page/ui
  locale: { type: String, enum: ['de', 'fr', 'it', 'es'], required: true },
  fields: { type: mongoose.Schema.Types.Mixed, default: {} }, // { name, description, metaTitle, … } → translated
  source: { type: String, enum: ['ai', 'manual'], default: 'ai' },
}, { timestamps: true, minimize: false });

// One row per resource+locale; also the lookup index for render-time reads.
translationSchema.index({ resourceType: 1, resourceId: 1, locale: 1 }, { unique: true });

module.exports = mongoose.model('Translation', translationSchema);
