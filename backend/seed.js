const mongoose = require('mongoose');
const Product = require('./models/Product');
require('dotenv').config();

const products = [
  {
    name: 'Ciara Silk Shorts',
    price: 89,
    category: 'shorts',
    description: 'Thigh-length silk shorts with straight hem and logo waistband. Designed for a slightly loose fit.',
    colours: ['Sky Blue', 'Wine Red', 'Champagne Beige', 'Sienna Copper'],
    sizes: ['XS', 'S', 'M', 'L', 'XL']
  },
  {
    name: 'Bastet Silk Shorts',
    price: 89,
    category: 'shorts',
    description: 'Silk shorts with a pattern inspired by Bastet, the ancient Egyptian Goddess. Thigh-length with straight hem.',
    colours: ['Emerald Green', 'Navy Blue'],
    sizes: ['XS', 'S', 'M', 'L', 'XL']
  },
  {
    name: 'Dalia Silk Dress',
    price: 129,
    category: 'dresses',
    description: 'Bias cut silk slip dress with adjustable straps and fully lined bust panels.',
    colours: ['Sienna Copper', 'Sky Blue', 'Champagne Beige', 'Wine Red'],
    sizes: ['XS', 'S', 'M', 'L', 'XL']
  },
  {
    name: 'Rehab Silk Robe',
    price: 279,
    category: 'robes',
    description: 'Silk kimono robe. 19 momme silk, kimono-style sleeves, waist tie closure. Made in Japan.',
    colours: ['Wine Red', 'Champagne Beige', 'Sienna Copper', 'Sky Blue'],
    sizes: ['One Size']
  },
  {
    name: 'Bastet Silk Robe',
    price: 299,
    category: 'robes',
    description: 'Kimono silk robe inspired by Bastet. 19 momme silk, kimono-style sleeves, waist tie closure. Made in Ireland.',
    colours: ['Emerald Green'],
    sizes: ['One Size']
  },
  {
    name: 'Nefer Silk Robe',
    price: 299,
    category: 'robes',
    description: 'Kimono silk robe inspired by Nefertiti. 19 momme silk, navy blue with red collar. Made in Japan.',
    colours: ['Navy Blue'],
    sizes: ['One Size']
  },
  {
    name: 'Mila Silk Shirt',
    price: 159,
    category: 'shirts',
    description: '19 momme silk shirt with buttoned cuffs and button fastenings along front. Made in Ireland.',
    colours: ['Champagne Beige', 'Wine Red', 'Sienna Copper', 'Sky Blue'],
    sizes: ['XS', 'S', 'M', 'L', 'XL']
  },
  {
    name: 'Voyage de Souvenirs Silk Scarf',
    price: 69,
    category: 'scarves',
    description: 'Luxurious 100% silk scarf 88x88cm. Hand-rolled edges. A celebration of travel and memories, crafted in Ireland.',
    colours: ['Multicolour'],
    sizes: []
  },
  {
    name: 'Nekhbet Silk Scarf',
    price: 69,
    category: 'scarves',
    description: 'Heritage collection silk scarf inspired by Nekhbet. Hand-rolled edges, 88x88cm. Made in Ireland.',
    colours: ['Black'],
    sizes: []
  },
  {
    name: 'Bastet Silk Scarf',
    price: 69,
    category: 'scarves',
    description: 'Heritage collection silk scarf inspired by Bastet. Hand-rolled edges, 88x88cm. Made in Ireland.',
    colours: ['Black'],
    sizes: []
  },
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