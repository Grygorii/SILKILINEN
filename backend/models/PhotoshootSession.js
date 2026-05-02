const mongoose = require('mongoose');

const generatedPhotoSchema = new mongoose.Schema({
  url: String,
  prompt: String,
  position: { type: String, enum: ['front', 'side', 'detail', 'lifestyle'] },
  iterationCount: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  feedback: String,
  generationCost: { type: Number, default: 0 },
}, { _id: false });

const photoshootSessionSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  selectedModel: { type: mongoose.Schema.Types.ObjectId, ref: 'AiModel', required: true },
  inputPhotos: [String],
  generatedPhotos: [generatedPhotoSchema],
  totalCost: { type: Number, default: 0 },
  iterationCount: { type: Number, default: 0 },
  status: { type: String, enum: ['in-progress', 'approved', 'cancelled'], default: 'in-progress' },
}, { timestamps: true });

module.exports = mongoose.model('PhotoshootSession', photoshootSessionSchema);
