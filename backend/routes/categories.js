'use strict';

const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Category = require('../models/Category');
const { localizeDocs } = require('../services/translator');

// GET /api/categories
// Returns active categories from the DB (sorted by displayOrder) with a
// product count attached. Response shape stays
// `{ slug, label, count, heroImage?, description? }` so existing consumers
// (ProductGrid filter, CategoryTiles) keep working — heroImage/description
// are additive and ignored by callers that don't read them.
router.get('/', async function(req, res) {
  try {
    const [categories, counts, sampleImages] = await Promise.all([
      Category.find({ status: 'active' }).sort({ displayOrder: 1, createdAt: 1 }).lean(),
      Product.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
      // A representative photo per category, taken from the newest active
      // product that has one. The storefront's category tiles fall back to this
      // when no curated image is set, so the homepage never shows empty boxes —
      // the shop always looks like a shop, even before the founder uploads
      // bespoke category art.
      Product.aggregate([
        { $match: { status: 'active', 'images.0.url': { $type: 'string', $ne: '' } } },
        { $sort: { isNewArrival: -1, createdAt: -1 } },
        { $group: { _id: '$category', url: { $first: { $arrayElemAt: ['$images.url', 0] } }, alt: { $first: '$name' } } },
      ]).catch(() => []),
    ]);

    const countMap = {};
    counts.forEach(c => { countMap[c._id] = c.count; });
    const sampleMap = {};
    sampleImages.forEach(s => { if (s?.url) sampleMap[s._id] = { url: s.url, alt: s.alt || '' }; });

    // Overlay translations (label/description/meta) for a requested locale before
    // shaping — English stays the fallback when a field isn't translated.
    await localizeDocs('category', categories, req.query.locale);

    const result = categories.map(cat => ({
      slug: cat.slug,
      label: cat.label,
      count: countMap[cat.slug] || 0,
      description: cat.description || '',
      metaTitle: cat.metaTitle || '',
      metaDescription: cat.metaDescription || '',
      heroImage: cat.heroImage || null,
      // Never null when the category has any photographed product.
      sampleImage: sampleMap[cat.slug] || null,
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
