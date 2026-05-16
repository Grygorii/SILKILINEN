const mongoose = require('mongoose');

const segmentSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  label: { type: String, required: true },
  description: { type: String, default: '' },
  color: { type: String, default: '#666' },
  count: { type: Number, default: 0 },
  lastComputedAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Segment', segmentSchema);
