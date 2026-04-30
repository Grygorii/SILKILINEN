const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  category: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  colours: [String],
  image: String,
  sizes: [String],
});

module.exports = mongoose.model('Product', productSchema);
