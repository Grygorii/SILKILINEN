const mongoose = require('mongoose');

// First-party event stream — the owned clickstream spine. Unlike GA4/Clarity
// (third-party scripts blocked on 30–40% of traffic and impossible to join to
// an order), these events are same-origin, persisted in our own DB, and keyed
// by sessionId so a whole customer journey — query → click → cart → order — can
// be reconstructed and joined to revenue and Search Console data.
//
// Mirrors the Visit model's privacy posture: no raw PII, sessionId is an opaque
// client id, geo/identity stitching happens later via the sessionId → Visit →
// Customer → Order chain. 90-day TTL like Visit.
const eventSchema = new mongoose.Schema({
  sessionId:  { type: String, required: true, index: true },
  // Event name: card_click, view_item, add_to_cart, remove_from_cart,
  // begin_checkout, purchase, search, wishlist_toggle, quiz_cta, scroll_depth,
  // outbound_click, web_vitals, … Free-form so new events need no migration.
  type:       { type: String, required: true },
  page:       { type: String },
  productId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product', sparse: true, index: true },
  // Bounded free-form payload (search query, size, value, label, href, metric…).
  props:      { type: mongoose.Schema.Types.Mixed },
  source:     { type: String },
  device:     { type: String, enum: ['mobile', 'desktop', 'tablet', 'unknown'], default: 'unknown' },
  // Stitched in later from the Visit/session when known.
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', sparse: true, index: true },
  createdAt:  { type: Date, default: Date.now, index: true },
});

// Hot query paths: "all events of type X over time" (funnel counts) and
// "this session's ordered path" (journey reconstruction).
eventSchema.index({ type: 1, createdAt: -1 });
eventSchema.index({ sessionId: 1, createdAt: 1 });
// Auto-purge after 90 days, matching Visit.
eventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

module.exports = mongoose.model('Event', eventSchema);
