const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  category: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  colours: [String],
  image: String,
  sizes: [String],
  stockLevel: { type: Number, default: null },
  metaTitle: { type: String, trim: true },
  metaDescription: { type: String, trim: true },
  slug: { type: String, trim: true },
  altText: { type: String, trim: true },
});

module.exports = mongoose.model('Product', productSchema);
