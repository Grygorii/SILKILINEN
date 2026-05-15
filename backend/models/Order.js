const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  stripeSessionId: { type: String, default: null },

  // Payment Intent fields (v2 checkout)
  stripePaymentIntentId: { type: String, default: null },
  stripeChargeId: { type: String },
  orderNumber: { type: String },
  customerEmail: { type: String },
  customerName: { type: String },
  customerPhone: { type: String },
  shippingAddress: {
    line1: String,
    line2: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
  },
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    name: { type: String },
    price: { type: Number },
    colour: { type: String },
    size: { type: String },
    quantity: { type: Number },
  }],
  subtotal: { type: Number, default: 0 },
  discountCode: { type: String },
  discountAmount: { type: Number, default: 0 },
  total: { type: Number },
  shippingCost: { type: Number, default: 0 },
  shippingMethod: { type: String },

  status: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded', 'partially_refunded'],
    default: 'pending',
  },
  statusHistory: [{
    status: { type: String },
    note: { type: String, default: '' },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    timestamp: { type: Date, default: Date.now },
  }],

  trackingNumber: { type: String },
  trackingUrl: { type: String },
  carrier: { type: String },
  shippedAt: { type: Date },
  deliveredAt: { type: Date },
  estimatedDelivery: { type: Date },

  customerNote: { type: String },
  internalNote: { type: String },

  refundedAmount: { type: Number },
  refundedAt: { type: Date },
  refundReason: { type: String },

  refunds: [{
    stripeRefundId: { type: String },
    amount: { type: Number },
    reason: { type: String },
    createdAt: { type: Date, default: Date.now },
    _id: false,
  }],

  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },

  attribution: {
    source:      { type: String, default: 'direct' },
    medium:      { type: String, default: 'none' },
    campaign:    { type: String, default: 'none' },
    referrer:    { type: String, default: '' },
    landingPage: { type: String, default: '' },
  },

  // Browser session ID from the frontend tracking lib (localStorage).
  // Used to link the originating Visit document to this order after payment.
  browserSessionId: { type: String },
}, { timestamps: true });

orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ customerEmail: 1 });
// Partial unique indexes — only enforce uniqueness when the field is actually set.
// This allows multiple documents with null/undefined (e.g. before payment is created)
// while still preventing duplicate Stripe IDs once set.
orderSchema.index(
  { stripeSessionId: 1 },
  { unique: true, partialFilterExpression: { stripeSessionId: { $type: 'string' } } }
);
orderSchema.index(
  { stripePaymentIntentId: 1 },
  { unique: true, partialFilterExpression: { stripePaymentIntentId: { $type: 'string' } } }
);
orderSchema.index(
  { orderNumber: 1 },
  { unique: true, partialFilterExpression: { orderNumber: { $type: 'string' } } }
);

module.exports = mongoose.model('Order', orderSchema);
