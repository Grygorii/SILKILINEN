const mongoose = require('mongoose');

// A customer who asked to be told when a sold-out piece returns.
//
// The storefront's "Notify when available" button was a mailto: link. On a
// desktop without a configured mail client that click does nothing at all, and
// even when it opens, the request lands unstructured in an inbox where nobody
// is notified on restock. It was the single clearest buying signal the shop can
// receive — a customer naming the exact piece they want — and it was discarded.
const stockNotificationSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  email:   { type: String, required: true, lowercase: true, trim: true },
  // Optional: they may want one size back, not any size.
  size:    { type: String, default: '' },
  colour:  { type: String, default: '' },
  // Set when the restock email goes out. Kept (rather than deleted) so the same
  // person is never emailed twice for one request, and so the admin can see
  // that a waitlist converted.
  notifiedAt: { type: Date, default: null },
}, { timestamps: true });

// One live request per person per product/variant — a customer clicking twice
// must not be emailed twice. Partial so that once notified, they may join again
// for a future restock.
stockNotificationSchema.index(
  { product: 1, email: 1, size: 1, colour: 1 },
  { unique: true, partialFilterExpression: { notifiedAt: null } },
);
// The restock sweep asks "who is still waiting for this product?".
stockNotificationSchema.index({ product: 1, notifiedAt: 1 });

module.exports = mongoose.model('StockNotification', stockNotificationSchema);
