const mongoose = require('mongoose');

const imageSpecSchema = new mongoose.Schema({
  aspectRatio: String,
  label:       String,
  pixelWidth:  Number,
  pixelHeight: Number,
  isDefault:   { type: Boolean, default: false },
}, { _id: false });

const socialPlatformSchema = new mongoose.Schema({
  key:         { type: String, required: true, unique: true },
  displayName: { type: String, required: true },
  icon:        { type: String, required: true },   // key used in frontend PLATFORM_ICONS map
  brandColor:  { type: String },
  baseUrl:     { type: String },

  imageSpecs:           [imageSpecSchema],
  captionMaxChars:      Number,
  captionRecommended:   Number,
  hashtagsAllowed:      { type: Boolean, default: true },
  hashtagsRecommended:  Number,
  hashtagsMax:          Number,
  supportsVideo:        { type: Boolean, default: true },
  supportsCarousel:     { type: Boolean, default: false },
  supportsAltText:      { type: Boolean, default: true },
  tips:                 [String],

  // The account URL — set via Connections admin page
  url: { type: String, default: '' },

  isActive:  { type: Boolean, default: true, index: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('SocialPlatform', socialPlatformSchema);
