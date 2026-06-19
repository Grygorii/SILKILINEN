const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  // Exactly one of productId / bundleId is set per item. Single-product
  // lines keep `productId`; bundle lines use `bundleId` and store the
  // discounted bundle price as the line price plus a read-only
  // `includedProducts` list for cart display. Route-level validation in
  // POST /api/cart/:sessionId/items enforces the either/or.
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  bundleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bundle' },
  includedProducts: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String },
    quantity: { type: Number, default: 1 },
    _id: false,
  }],
  name: { type: String, required: true },
  price: { type: Number, required: true },
  image: { type: String },
  colour: { type: String, default: '' },
  size: { type: String, default: '' },
  quantity: { type: Number, required: true, min: 1, max: 99 },
}, { _id: true });

const cartSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  items: [cartItemSchema],
  discountCode: { type: String, default: null },
  discountAmount: { type: Number, default: 0 },
  shippingCountry: { type: String, default: 'IE' },
  // Abandoned-cart recovery: the email captured at checkout, which sequence
  // emails have already been sent (dedup), and a one-click unsubscribe flag. A
  // cart still present past the window IS an abandonment — the Stripe webhook
  // deletes the cart on a completed purchase.
  email: { type: String, default: null },
  recoveryEmails: [{ seq: Number, sentAt: Date, _id: false }],
  recoveryUnsubscribed: { type: Boolean, default: false },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
}, { timestamps: true });

// Auto-delete expired carts
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Cart', cartSchema);
