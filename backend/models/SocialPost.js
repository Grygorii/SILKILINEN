const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  url:         String,
  altText:     String,
  cloudinaryId:String,
}, { _id: false });

const variationSchema = new mongoose.Schema({
  platformKey:              { type: String, required: true },
  enabled:                  { type: Boolean, default: true },
  customCaption:            String,
  customImages:             [imageSchema],
  customHashtags:           [String],
  customPrimaryImageIndex:  Number,
}, { _id: false });

const postedToSchema = new mongoose.Schema({
  platformKey: String,
  postedAt:    Date,
  postedBy:    String,
  note:        String,
}, { _id: false });

const socialPostSchema = new mongoose.Schema({
  title:             String,
  defaultCaption:    String,
  defaultImages:     [imageSchema],
  defaultHashtags:   [String],
  primaryImageIndex: { type: Number, default: 0 },

  platformVariations: [variationSchema],
  postedTo:           [postedToSchema],

  status:    { type: String, enum: ['draft', 'ready', 'posted'], default: 'draft', index: true },
  postedAt:  Date,
  lastEditedBy: String,
}, { timestamps: true });

module.exports = mongoose.model('SocialPost', socialPostSchema);
