const mongoose = require('mongoose');

const spendUpdateSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  date:   { type: Date,   default: Date.now },
  note:   { type: String, default: '' },
}, { _id: true });

const creativeSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  utmContent: { type: String, required: true },
  notes:      { type: String, default: '' },
}, { _id: true });

const campaignSchema = new mongoose.Schema({
  name:    { type: String, required: true },
  slug:    { type: String, required: true, unique: true },
  channel: { type: String, enum: ['instagram', 'pinterest', 'google', 'facebook', 'email', 'other'], required: true },
  status:  { type: String, enum: ['draft', 'active', 'paused', 'ended'], default: 'draft' },

  startDate: { type: Date },
  endDate:   { type: Date },

  budget: { type: Number, default: 0 },
  spend:  { type: Number, default: 0 },
  spendUpdates: [spendUpdateSchema],

  creatives:      [creativeSchema],
  targetProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  notes:          { type: String, default: '' },
  createdBy:      { type: String },
}, { timestamps: true });

campaignSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Campaign', campaignSchema);
