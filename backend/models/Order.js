const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  stripeSessionId: { type: String, required: true, unique: true },
  customerEmail: { type: String },
  items: [{
    name: { type: String },
    price: { type: Number },
    colour: { type: String },
    size: { type: String },
    quantity: { type: Number },
  }],
  total: { type: Number },
  status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
