'use strict';

const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Category = require('../models/Category');

// GET /api/categories
// Returns active categories from the DB (sorted by displayOrder) with a
// product count attached. Response shape stays
// `{ slug, label, count, heroImage?, description? }` so existing consumers
// (ProductGrid filter, CategoryTiles) keep working — heroImage/description
// are additive and ignored by callers that don't read them.
router.get('/', async function(req, res) {
  try {
    const [categories, counts] = await Promise.all([
      Category.find({ status: 'active' }).sort({ displayOrder: 1, createdAt: 1 }).lean(),
      Product.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
    ]);

    const countMap = {};
    counts.forEach(c => { countMap[c._id] = c.count; });

    const result = categories.map(cat => ({
      slug: cat.slug,
      label: cat.label,
      count: countMap[cat.slug] || 0,
      description: cat.description || '',
      metaTitle: cat.metaTitle || '',
      metaDescription: cat.metaDescription || '',
      heroImage: cat.heroImage || null,
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
