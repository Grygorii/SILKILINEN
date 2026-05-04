const mongoose = require('mongoose');
const crypto = require('crypto');

const newsletterSchema = new mongoose.Schema({
  email:              { type: String, required: true, unique: true, lowercase: true, trim: true },
  source:             { type: String, default: 'popup' },
  subscribedAt:       { type: Date, default: Date.now },
  discountCodeIssued: { type: String, default: '' },
  discountCodeUsed:   { type: Boolean, default: false },
  isUnsubscribed:     { type: Boolean, default: false },
  unsubscribeToken:   { type: String, default: () => crypto.randomBytes(20).toString('hex') },
  customerId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
}, { timestamps: true });

newsletterSchema.index({ email: 1 });
newsletterSchema.index({ unsubscribeToken: 1 });

module.exports = mongoose.model('Newsletter', newsletterSchema);
