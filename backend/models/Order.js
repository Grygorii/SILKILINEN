const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  stripeSessionId: { type: String, required: true, unique: true },
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
    name: { type: String },
    price: { type: Number },
    colour: { type: String },
    size: { type: String },
    quantity: { type: Number },
  }],
  total: { type: Number },
  shippingCost: { type: Number, default: 0 },
  shippingMethod: { type: String },

  status: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded'],
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

  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
