const mongoose = require('mongoose');

const visitSchema = new mongoose.Schema({
  sessionId:  { type: String, required: true, index: true },
  page:       { type: String, required: true },
  productId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product', index: true },
  source:     { type: String, required: true, default: 'direct' },
  utm: {
    source:   String,
    medium:   String,
    campaign: String,
    term:     String,
    content:  String,
  },
  referrer:   String,
  device:     { type: String, enum: ['mobile', 'desktop', 'tablet', 'unknown'], default: 'unknown' },
  country:     String,
  countryCode: String,
  city:        String,
  region:      String,
  // sha256 hash of the visitor's IP — for unique-visitor analytics that
  // survives localStorage sessionId resets. Not reversible to a person
  // without the original IP, so GDPR-friendly. Indexed for fast
  // distinct-count aggregations in the admin dashboard.
  ipHash:      { type: String, index: true, sparse: true },
  createdAt:   { type: Date, default: Date.now, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', sparse: true, index: true },
  convertedToOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', sparse: true },
});

// TTL index — purge visits older than 90 days automatically
visitSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

module.exports = mongoose.model('Visit', visitSchema);
