const express = require('express');
const router = express.Router();
const Collection = require('../models/Collection');
const Product = require('../models/Product');

// GET /api/collections — all active collections
router.get('/', async (req, res) => {
  try {
    const collections = await Collection.find({ status: 'active' })
      .sort({ displayOrder: 1, createdAt: -1 })
      .select('-__v');
    res.json(collections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/collections/featured — featured active collections (for homepage)
router.get('/featured', async (req, res) => {
  try {
    const collections = await Collection.find({ status: 'active', isFeatured: true })
      .sort({ featuredOrder: 1 })
      .select('-__v');
    res.json(collections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/collections/:slug — collection detail + active products
router.get('/:slug', async (req, res) => {
  try {
    const collection = await Collection.findOne({ slug: req.params.slug, status: 'active' });
    if (!collection) return res.status(404).json({ error: 'Collection not found' });

    const products = await Product.find({ collections: collection._id, status: 'active' })
      .select('_id name price compareAtPrice images image altText colours sizes totalStock inStock slug colorName colorVariants')
      .sort({ createdAt: -1 });

    res.json({ ...collection.toObject(), products });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
