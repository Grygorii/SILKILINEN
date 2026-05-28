const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  line1: String,
  line2: String,
  city: String,
  county: String,
  postcode: String,
  country: { type: String, default: 'IE' },
}, { _id: false });

const noteSchema = new mongoose.Schema({
  body: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const emailLogSchema = new mongoose.Schema({
  subject: String,
  template: String,
  sentAt: { type: Date, default: Date.now },
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

  // ── Intelligence fields (backward-compatible, all optional) ──────────────────
  tags: [{ type: String }],
  notes: [noteSchema],
  customerType: { type: String, enum: ['retail', 'wholesale', 'vip', 'internal'], default: 'retail' },
  internalRating: { type: Number, min: 1, max: 5, default: null },

  // Order-derived stats (updated by backfill + webhook)
  firstOrderAt: { type: Date, default: null },
  lastOrderAt: { type: Date, default: null },
  orderCount: { type: Number, default: 0 },
  totalSpend: { type: Number, default: 0 },

  // Location from last order shipping address
  country: { type: String, default: '' },
  city: { type: String, default: '' },

  // Acquisition attribution (from first-touch Visit doc)
  acquisitionSource: { type: String, default: '' },
  acquisitionMedium: { type: String, default: '' },
  acquisitionCampaign: { type: String, default: '' },
  acquisitionCampaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', default: null },
  acquisitionVisitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Visit', default: null },
  acquiredAt: { type: Date, default: null },

  // Auto-computed segment slugs (recomputed on demand / after each order)
  segments: [{ type: String }],

  // Email activity log (last 100 entries)
  emailLog: { type: [emailLogSchema], default: [] },

  // GDPR
  gdprDeletedAt: { type: Date, default: null },
  consent: { type: String, enum: ['accepted', 'rejected', null], default: null },
}, { timestamps: true });

customerSchema.index({ email: 1 }, { unique: true });
customerSchema.index({ googleId: 1 }, { sparse: true });
customerSchema.index({ segments: 1 });
customerSchema.index({ lastOrderAt: -1 });
customerSchema.index({ totalSpend: -1 });

// F22: sparse index on the magic-link token. Removes the linear collection
// scan that findOne({ emailVerificationToken }) used to do, and closes the
// per-character timing channel that scan introduced. Partial filter keeps
// the index small — only customers with a pending token appear in it.
customerSchema.index(
  { emailVerificationToken: 1 },
  { sparse: true, partialFilterExpression: { emailVerificationToken: { $type: 'string' } } }
);

module.exports = mongoose.model('Customer', customerSchema);
