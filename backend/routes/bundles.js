'use strict';

const express = require('express');
const router = express.Router();
const Bundle = require('../models/Bundle');

// Trim the product subdoc shape we send to the storefront — no costing,
// no admin metadata, no variants spilling out via the populate.
const PUBLIC_PRODUCT_FIELDS = 'name slug price images colours sizes status totalStock';

function shapeBundle(doc) {
  const obj = doc.toObject ? doc.toObject() : doc;
  const products = (obj.products || [])
    .map(p => p.productId)
    .filter(Boolean);
  const pricing = Bundle.computePricing(products, obj.discountPercent);
  return {
    _id: obj._id,
    name: obj.name,
    slug: obj.slug,
    description: obj.description || '',
    heroImage: obj.heroImage || null,
    discountPercent: pricing.discountPercent,
    originalTotal: pricing.originalTotal,
    bundlePrice: pricing.bundlePrice,
    savings: pricing.savings,
    products,
    isFeatured: !!obj.isFeatured,
    metaTitle: obj.metaTitle || '',
    metaDescription: obj.metaDescription || '',
  };
}

// GET /api/bundles — all active bundles, sorted by displayOrder
router.get('/', async function(req, res) {
  try {
    const bundles = await Bundle.find({ status: 'active' })
      .sort({ displayOrder: 1, createdAt: -1 })
      .populate({ path: 'products.productId', select: PUBLIC_PRODUCT_FIELDS });
    res.json(bundles.map(shapeBundle));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/bundles/featured — active + isFeatured, sorted by featuredOrder
router.get('/featured', async function(req, res) {
  try {
    const bundles = await Bundle.find({ status: 'active', isFeatured: true })
      .sort({ featuredOrder: 1, createdAt: -1 })
      .populate({ path: 'products.productId', select: PUBLIC_PRODUCT_FIELDS });
    res.json(bundles.map(shapeBundle));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/bundles/:slug — single bundle for the storefront PDP-equivalent
router.get('/:slug', async function(req, res) {
  try {
    const bundle = await Bundle.findOne({ slug: req.params.slug, status: 'active' })
      .populate({ path: 'products.productId', select: PUBLIC_PRODUCT_FIELDS });
    if (!bundle) return res.status(404).json({ error: 'Not found' });
    res.json(shapeBundle(bundle));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
