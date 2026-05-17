const mongoose = require('mongoose');

const EXPENSE_CATEGORIES = [
  'shipping_per_order',
  'materials_silk',
  'materials_linen',
  'materials_other',
  'packaging',
  'software_saas',
  'marketing_ads',
  'marketing_tools',
  'professional_fees',
  'studio_workspace',
  'equipment',
  'bank_payment_fees',
  'tax_vat',
  'refunds',
  'other',
];

const expenseSchema = new mongoose.Schema({
  amount:      { type: Number, required: true, min: 0 },
  date:        { type: Date, required: true, index: true },
  category:    { type: String, enum: EXPENSE_CATEGORIES, required: true, index: true },
  description: { type: String, required: true, trim: true },
  notes:       { type: String, trim: true },

  orderIds:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order', index: true }],
  receiptId: { type: mongoose.Schema.Types.ObjectId, ref: 'Receipt' },

  // If true, this entry was auto-created by the system (Stripe refund, campaign spend) and
  // should not be directly edited from the Finance tab. Edit via the source (Marketing, Stripe).
  isAutomatic: { type: Boolean, default: false },
  sourceRef:   { type: String }, // e.g. 'campaign:64abc123' or 'stripe:pi_xyz'

  isRecurring:         { type: Boolean, default: false },
  recurringFrequency:  { type: String, enum: ['monthly', 'yearly', null], default: null },
  taxDeductible:       { type: Boolean, default: true },

  createdBy: { type: String },
}, { timestamps: true });

expenseSchema.index({ date: -1, category: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
module.exports.EXPENSE_CATEGORIES = EXPENSE_CATEGORIES;
