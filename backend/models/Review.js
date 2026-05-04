const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  reviewer:     { type: String, required: true },
  message:      { type: String, default: '' },
  title:        { type: String, default: '' },
  starRating:   { type: Number, required: true, min: 1, max: 5 },
  dateReviewed: { type: Date, default: Date.now },
  orderId:      { type: Number },
  source:       { type: String, default: 'etsy' },
  verified:     { type: Boolean, default: true },
  helpfulCount: { type: Number, default: 0 },
  photos:       [String],
}, { timestamps: true });

module.exports = mongoose.model('Review', reviewSchema);
