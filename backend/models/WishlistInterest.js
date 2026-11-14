const mongoose = require('mongoose');

// Lifecycle metadata for an account-held wishlist item. Customer.wishlist is
// still the shopper-facing source of truth; this small record only tells us
// when a save happened and whether a single gentle reminder was attempted.
// Existing wishlists are deliberately not backfilled with made-up save dates.
const wishlistInterestSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  savedAt: { type: Date, required: true, default: Date.now },
  removedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  // Claimed before send so retries or another Railway instance cannot email
  // the same person twice. A failed attempt remains claimed on purpose.
  reminderAttemptedAt: { type: Date, default: null },
  reminderSentAt: { type: Date, default: null },
}, { timestamps: true });

wishlistInterestSchema.index({ customerId: 1, productId: 1 }, { unique: true });
wishlistInterestSchema.index({ removedAt: 1, completedAt: 1, reminderAttemptedAt: 1, savedAt: 1 });

module.exports = mongoose.model('WishlistInterest', wishlistInterestSchema);
