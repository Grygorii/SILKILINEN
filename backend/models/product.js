const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  category: String,
  colour: String,
  description: String,
  image: String,
  sizes: [String],
});

module.exports = mongoose.model('Product', productSchema);