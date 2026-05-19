const mongoose = require('mongoose');

const socialAssetSchema = new mongoose.Schema({
  surface: { type: String, required: true },
  prompt: { type: String, required: true },
  cloudinaryUrl: { type: String, required: true },
  cloudinaryPublicId: { type: String, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  aspect: { type: String, required: true },
  isWinner: { type: Boolean, default: false },
  generatedAt: { type: Date, default: Date.now },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  geminiRequestId: { type: String },
}, { timestamps: false });

socialAssetSchema.index({ surface: 1, isWinner: -1, generatedAt: -1 });

module.exports = mongoose.model('SocialAsset', socialAssetSchema);
