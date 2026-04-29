const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  category: String,
  description: String,
  colours: [String],
  image: String,
  sizes: [String],
});

module.exports = mongoose.model('Product', productSchema);