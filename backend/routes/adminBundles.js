const express = require('express');
const router = express.Router();
const Bundle = require('../models/Bundle');
const Product = require('../models/Product');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// GET /api/admin/bundles
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const bundles = await Bundle.find(filter)
      .sort({ displayOrder: 1, createdAt: -1 })
      .populate({ path: 'products.productId', select: 'name price status' });

    const enriched = bundles.map(b => {
      const obj = b.toObject();
      const populated = (obj.products || []).map(p => p.productId).filter(Boolean);
      const pricing = Bundle.computePricing(populated, obj.discountPercent);
      return {
        ...obj,
        productCount: populated.length,
        originalTotal: pricing.originalTotal,
        bundlePrice: pricing.bundlePrice,
        savings: pricing.savings,
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/bundles
router.post('/', async (req, res) => {
  try {
    const { name, slug, description, heroImage, discountPercent, isFeatured, featuredOrder, displayOrder, status, metaTitle, metaDescription } = req.body;
    if (!name || !slug) return res.status(400).json({ error: 'name and slug are required' });
    const bundle = new Bundle({
      name, slug, description, heroImage,
      discountPercent: discountPercent || 0,
      isFeatured, featuredOrder, displayOrder, status,
      metaTitle, metaDescription,
    });
    await bundle.save();
    res.status(201).json(bundle);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'A bundle with this slug already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/bundles/:id — detail with populated products and live pricing
router.get('/:id', async (req, res) => {
  try {
    const bundle = await Bundle.findById(req.params.id)
      .populate({ path: 'products.productId', select: 'name slug price status images' });
    if (!bundle) return res.status(404).json({ error: 'Not found' });

    const obj = bundle.toObject();
    const populated = (obj.products || []).map(p => p.productId).filter(Boolean);
    const pricing = Bundle.computePricing(populated, obj.discountPercent);

    res.json({ ...obj, ...pricing });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/bundles/:id
router.patch('/:id', async (req, res) => {
  try {
    const allowed = ['name', 'slug', 'description', 'heroImage', 'discountPercent', 'categories', 'isFeatured', 'featuredOrder', 'displayOrder', 'status', 'metaTitle', 'metaDescription'];
    const updates = {};
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }
    const bundle = await Bundle.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!bundle) return res.status(404).json({ error: 'Not found' });
    res.json(bundle);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'A bundle with this slug already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/bundles/:id  (soft archive)
router.delete('/:id', async (req, res) => {
  try {
    const bundle = await Bundle.findByIdAndUpdate(req.params.id, { status: 'archived' }, { new: true });
    if (!bundle) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Archived', bundle });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/bundles/:id/permanent — hard delete (removes the record).
// Bundle products are embedded, so nothing else needs detaching.
router.delete('/:id/permanent', async (req, res) => {
  try {
    const bundle = await Bundle.findByIdAndDelete(req.params.id);
    if (!bundle) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/bundles/:id/products — assign product to bundle
router.post('/:id/products', async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ error: 'productId required' });

    const product = await Product.exists({ _id: productId });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const bundle = await Bundle.findById(req.params.id);
    if (!bundle) return res.status(404).json({ error: 'Bundle not found' });

    if (bundle.products.some(p => String(p.productId) === String(productId))) {
      return res.status(400).json({ error: 'Product already in bundle' });
    }
    bundle.products.push({ productId, displayOrder: bundle.products.length });
    await bundle.save();
    res.json({ message: 'Product added to bundle' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/bundles/:id/products/:productId
router.delete('/:id/products/:productId', async (req, res) => {
  try {
    const bundle = await Bundle.findById(req.params.id);
    if (!bundle) return res.status(404).json({ error: 'Bundle not found' });
    bundle.products = bundle.products.filter(p => String(p.productId) !== String(req.params.productId));
    await bundle.save();
    res.json({ message: 'Product removed from bundle' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
