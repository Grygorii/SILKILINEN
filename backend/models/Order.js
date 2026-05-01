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
  status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
