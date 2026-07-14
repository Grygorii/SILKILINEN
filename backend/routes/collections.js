const express = require('express');
const router = express.Router();
const Collection = require('../models/Collection');
const Product = require('../models/Product');
const { localizeDocs } = require('../services/translator');

// GET /api/collections — all active collections
router.get('/', async (req, res) => {
  try {
    const collections = await Collection.find({ status: 'active' })
      .sort({ displayOrder: 1, createdAt: -1 })
      .select('-__v');
    res.json(await localizeDocs('collection', collections, req.query.locale));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/collections/featured — featured active collections (for homepage)
router.get('/featured', async (req, res) => {
  try {
    const collections = await Collection.find({ status: 'active', isFeatured: true })
      .sort({ featuredOrder: 1 })
      .select('-__v');
    res.json(await localizeDocs('collection', collections, req.query.locale));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/collections/:slug — collection detail + active products
router.get('/:slug', async (req, res) => {
  try {
    const collection = await Collection.findOne({ slug: req.params.slug, status: 'active' });
    if (!collection) return res.status(404).json({ error: 'Collection not found' });

    const products = await Product.find({ collections: collection._id, status: 'active' })
      .select('_id name price compareAtPrice images image altText colours sizes totalStock inStock slug colorName variants')
      .sort({ createdAt: -1 })
      .lean();

    // Localise the collection + its products for a requested locale (in place).
    await localizeDocs('collection', collection, req.query.locale);
    await localizeDocs('product', products, req.query.locale);

    // Expose which sizes/colours are actually buyable so the "shop the set"
    // pickers can disable sold-out options — otherwise a buyer could pick a
    // sold-out size and only discover it when create-intent rejects the order.
    // Variant stock itself is not sent; only the in-stock option names.
    const shaped = products.map(p => {
      const variants = p.variants || [];
      const liveSizes = new Set();
      const liveColours = new Set();
      for (const v of variants) {
        if ((v.stockLevel || 0) > 0) {
          if (v.size) liveSizes.add(v.size);
          if (v.colour) liveColours.add(v.colour);
        }
      }
      // Untracked products (no variants) keep their full option lists.
      const availableSizes = variants.length ? (p.sizes || []).filter(s => liveSizes.has(s)) : (p.sizes || []);
      const availableColours = variants.length ? (p.colours || []).filter(c => liveColours.has(c)) : (p.colours || []);
      const { variants: _omit, ...rest } = p;
      return { ...rest, availableSizes, availableColours };
    });

    res.json({ ...collection.toObject(), products: shaped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
