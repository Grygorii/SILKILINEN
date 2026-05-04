const mongoose = require('mongoose');

const aiModelSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  heritage: { type: String, trim: true },
  description: { type: String, trim: true },
  prompt: { type: String, required: true, trim: true },
  referenceImageUrl: { type: String },
  useCases: [String],
  markets: [String],
  locked: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('AiModel', aiModelSchema);
