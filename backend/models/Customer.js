const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  line1: String,
  line2: String,
  city: String,
  county: String,
  postcode: String,
  country: { type: String, default: 'IE' },
}, { _id: false });

const customerSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, default: null },
  googleId: { type: String, default: null, sparse: true },
  firstName: { type: String, default: '' },
  lastName: { type: String, default: '' },
  phone: { type: String, default: '' },
  defaultShippingAddress: { type: addressSchema, default: null },
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  marketingConsent: { type: Boolean, default: false },
  emailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String, default: null },
  emailVerificationExpiry: { type: Date, default: null },
  passwordResetToken: { type: String, default: null },
  passwordResetExpiry: { type: Date, default: null },
  lastLogin: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);
