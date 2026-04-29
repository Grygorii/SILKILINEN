const mongoose = require('mongoose');
const Product = require('./models/product');
require('dotenv').config();

const products = [
  { name: 'Bastet Emerald Green Silk Shorts', price: 89, category: 'shorts', colour: 'Emerald Green', description: 'Silk shorts with a pattern inspired by Bastet, the ancient Egyptian Goddess. Thigh-length with straight hem and logo waistband.', sizes: ['XS', 'S', 'M', 'L', 'XL'] },
  { name: 'Nefertiti Navy Blue Silk Shorts', price: 89, category: 'shorts', colour: 'Navy Blue', description: 'Silk shorts with a pattern inspired by Nefertiti, the ancient Egyptian queen. Thigh-length with straight hem.', sizes: ['XS', 'S', 'M', 'L', 'XL'] },
  { name: 'Ciara Sienna Copper Silk Shorts', price: 89, category: 'shorts', colour: 'Sienna Copper', description: 'Sienna copper silk shorts. Thigh-length with straight hem and logo waistband.', sizes: ['XS', 'S', 'M', 'L', 'XL'] },
  { name: 'Ciara Sky Blue Silk Shorts', price: 89, category: 'shorts', colour: 'Sky Blue', description: 'Sky blue silk shorts. Thigh-length with straight hem and logo waistband.', sizes: ['XS', 'S', 'M', 'L', 'XL'] },
  { name: 'Ciara Champagne Beige Silk Shorts', price: 89, category: 'shorts', colour: 'Champagne Beige', description: 'Champagne beige silk shorts. Thigh-length with straight hem and logo waistband.', sizes: ['XS', 'S', 'M', 'L', 'XL'] },
  { name: 'Ciara Wine Red Silk Shorts', price: 89, category: 'shorts', colour: 'Wine Red', description: 'Wine red silk shorts. Thigh-length with straight hem and logo waistband.', sizes: ['XS', 'S', 'M', 'L', 'XL'] },
  { name: 'Dalia Sienna Copper Silk Dress', price: 129, category: 'dresses', colour: 'Sienna Copper', description: 'Bias cut silk slip dress with adjustable straps and fully lined bust panels.', sizes: ['XS', 'S', 'M', 'L', 'XL'] },
  { name: 'Dalia Sky Blue Silk Dress', price: 129, category: 'dresses', colour: 'Sky Blue', description: 'Bias cut silk slip dress with adjustable straps and fully lined bust panels.', sizes: ['XS', 'S', 'M', 'L', 'XL'] },
  { name: 'Dalia Champagne Beige Silk Dress', price: 129, category: 'dresses', colour: 'Champagne Beige', description: 'Bias cut silk slip dress with adjustable straps and fully lined bust panels.', sizes: ['XS', 'S', 'M', 'L', 'XL'] },
  { name: 'Dalia Wine Red Silk Dress', price: 129, category: 'dresses', colour: 'Wine Red', description: 'Bias cut silk slip dress with adjustable straps and fully lined bust panels.', sizes: ['XS', 'S', 'M', 'L', 'XL'] },
  { name: 'Voyage de Souvenirs Silk Scarf', price: 69, category: 'scarves', colour: 'Multicolour', description: 'Luxurious 100% silk scarf 88x88cm. Hand-rolled edges. A celebration of travel and memories, crafted in Ireland.', sizes: [] },
  { name: 'Nekhbet Night Black Silk Scarf', price: 69, category: 'scarves', colour: 'Black', description: 'Heritage collection silk scarf inspired by Nekhbet. Hand-rolled edges, 88x88cm, 100% silk. Made in Ireland.', sizes: [] },
  { name: 'Bastet Night Black Silk Scarf', price: 69, category: 'scarves', colour: 'Black', description: 'Heritage collection silk scarf inspired by Bastet. Hand-rolled edges, 88x88cm, 100% silk. Made in Ireland.', sizes: [] },
  { name: 'Bastet Emerald Green Silk Robe', price: 299, category: 'robes', colour: 'Emerald Green', description: 'Kimono silk robe inspired by Bastet. 19 momme silk, kimono-style sleeves, waist tie closure. Made in Ireland.', sizes: ['One Size'] },
  { name: 'Nefer Navy Blue Silk Robe', price: 299, category: 'robes', colour: 'Navy Blue', description: 'Kimono silk robe inspired by Nefertiti. 19 momme silk, navy blue with red collar, waist tie closure.', sizes: ['One Size'] },
  { name: 'Rehab Wine Red Silk Robe', price: 279, category: 'robes', colour: 'Wine Red', description: 'Wine red silk kimono robe. 19 momme silk, beige white waist tie closure. Made in Japan.', sizes: ['One Size'] },
  { name: 'Rehab Champagne Beige Silk Robe', price: 279, category: 'robes', colour: 'Champagne Beige', description: 'Champagne beige silk kimono robe. 19 momme silk, beige white waist tie closure. Made in Japan.', sizes: ['One Size'] },
  { name: 'Rehab Copper Silk Robe', price: 279, category: 'robes', colour: 'Sienna Copper', description: 'Sienna copper silk kimono robe. 19 momme silk, beige white waist tie closure. Made in Japan.', sizes: ['One Size'] },
  { name: 'Rehab Sky Blue Silk Robe', price: 279, category: 'robes', colour: 'Sky Blue', description: 'Sky blue silk kimono robe. 19 momme silk, natural white waist tie closure. Made in Japan.', sizes: ['One Size'] },
  { name: 'Mila Champagne Beige Silk Shirt', price: 159, category: 'shirts', colour: 'Champagne Beige', description: 'Champagne beige silk shirt. 19 momme silk, buttoned cuffs, button fastenings along front. Made in Ireland.', sizes: ['XS', 'S', 'M', 'L', 'XL'] },
  { name: 'Mila Wine Red Silk Shirt', price: 159, category: 'shirts', colour: 'Wine Red', description: 'Wine red silk shirt. 19 momme silk, buttoned cuffs, button fastenings along front. Made in Ireland.', sizes: ['XS', 'S', 'M', 'L', 'XL'] },
  { name: 'Mila Sienna Copper Silk Shirt', price: 159, category: 'shirts', colour: 'Sienna Copper', description: 'Sienna copper silk shirt. 19 momme silk, buttoned cuffs, button fastenings along front. Made in Ireland.', sizes: ['XS', 'S', 'M', 'L', 'XL'] },
  { name: 'Mila Sky Blue Silk Shirt', price: 159, category: 'shirts', colour: 'Sky Blue', description: 'Sky blue silk shirt. 19 momme silk, buttoned cuffs, button fastenings along front. Made in Ireland.', sizes: ['XS', 'S', 'M', 'L', 'XL'] },
];

mongoose.connect(process.env.MONGODB_URI)
  .then(async function() {
    console.log('Connected to MongoDB');
    await Product.deleteMany();
    await Product.insertMany(products);
    console.log(products.length + ' products added successfully');
    mongoose.connection.close();
  })
  .catch(function(err) {
    console.log('Error:', err);
  });