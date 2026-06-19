const mongoose = require('mongoose');

// A scraped intelligence profile for one competitor — built from their public
// Shopify /products.json (most luxury brands) or sitemap fallback. Refreshed on
// demand; one doc per domain so we can track change over time.
const SampleSchema = new mongoose.Schema({
  title: String,
  price: Number,
  type: String,
  url: String,
  publishedAt: Date,
}, { _id: false });

const CompetitorProfileSchema = new mongoose.Schema({
  domain: { type: String, required: true, unique: true },
  name: String,
  platform: { type: String, enum: ['shopify', 'woocommerce', 'jsonld', 'other', 'unknown'], default: 'unknown' },
  currency: { type: String, default: null },
  productCount: { type: Number, default: 0 },
  productCountCapped: { type: Boolean, default: false }, // true when we hit the 250 page cap
  priceMin: Number,
  priceMax: Number,
  priceAvg: Number,
  productTypes: [String],
  sampleProducts: [SampleSchema],
  newest: [SampleSchema],
  lastScrapedAt: Date,
  lastError: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('CompetitorProfile', CompetitorProfileSchema);
