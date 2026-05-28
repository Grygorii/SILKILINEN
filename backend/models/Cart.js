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
  expiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
}, { timestamps: true });

// Auto-delete expired carts
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Cart', cartSchema);
