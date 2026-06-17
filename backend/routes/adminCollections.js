const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const Collection = require('../models/Collection');
const Product = require('../models/Product');
const { requireAuth } = require('../middleware/auth');
const { generateSEO, AIServiceError } = require('../services/aiText');
const { pingIndexNow } = require('../services/indexNow');

// Instant-index a live collection (fire-and-forget). Skip drafts/archived —
// those URLs aren't public.
function pingCollection(c) {
  if (c && c.slug && c.status !== 'draft' && c.status !== 'archived') {
    pingIndexNow(`/collections/${c.slug}`);
  }
}

// All routes require admin auth
router.use(requireAuth);

// Same budget as the product/category SEO endpoints — bounded AI calls/hour.
const aiRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI generation calls in the last hour. Wait a few minutes and try again.' },
});

// GET /api/admin/collections
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const collections = await Collection.find(filter).sort({ displayOrder: 1, createdAt: -1 });

    // Enrich with product count
    const enriched = await Promise.all(collections.map(async (c) => {
      const count = await Product.countDocuments({ collections: c._id, status: 'active' });
      return { ...c.toObject(), productCount: count };
    }));

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/collections
router.post('/', async (req, res) => {
  try {
    const { name, slug, description, heroImage, isFeatured, featuredOrder, displayOrder, status, metaTitle, metaDescription } = req.body;
    const collection = new Collection({ name, slug, description, heroImage, isFeatured, featuredOrder, displayOrder, status, metaTitle, metaDescription });
    await collection.save();
    pingCollection(collection);
    res.status(201).json(collection);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'A collection with this slug already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/collections/:id
router.get('/:id', async (req, res) => {
  try {
    const collection = await Collection.findById(req.params.id);
    if (!collection) return res.status(404).json({ error: 'Not found' });

    const products = await Product.find({ collections: collection._id })
      .select('_id name status price images')
      .sort({ createdAt: -1 });

    res.json({ ...collection.toObject(), products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/collections/:id
router.patch('/:id', async (req, res) => {
  try {
    const allowed = ['name', 'slug', 'description', 'heroImage', 'isFeatured', 'featuredOrder', 'displayOrder', 'status', 'metaTitle', 'metaDescription'];
    const updates = {};
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }
    const collection = await Collection.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!collection) return res.status(404).json({ error: 'Not found' });
    pingCollection(collection);
    res.json(collection);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'A collection with this slug already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/collections/:id  (soft archive)
router.delete('/:id', async (req, res) => {
  try {
    const collection = await Collection.findByIdAndUpdate(req.params.id, { status: 'archived' }, { new: true });
    if (!collection) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Archived', collection });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/collections/:id/permanent — hard delete. Detaches the
// collection from any products first so none are left pointing at a dead id.
router.delete('/:id/permanent', async (req, res) => {
  try {
    const collection = await Collection.findById(req.params.id);
    if (!collection) return res.status(404).json({ error: 'Not found' });
    await Product.updateMany({ collections: collection._id }, { $pull: { collections: collection._id } });
    await Collection.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/collections/:id/products  — assign product to collection
router.post('/:id/products', async (req, res) => {
  try {
    const { productId } = req.body;
    await Product.findByIdAndUpdate(productId, { $addToSet: { collections: req.params.id } });
    res.json({ message: 'Product added to collection' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/collections/:id/products/:productId — remove product from collection
router.delete('/:id/products/:productId', async (req, res) => {
  try {
    await Product.findByIdAndUpdate(req.params.productId, { $pull: { collections: req.params.id } });
    res.json({ message: 'Product removed from collection' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/collections/reorder — bulk update displayOrder
router.put('/reorder', async (req, res) => {
  try {
    const { order } = req.body; // [{ id, displayOrder }, ...]
    await Promise.all(order.map(({ id, displayOrder }) =>
      Collection.findByIdAndUpdate(id, { displayOrder })
    ));
    res.json({ message: 'Reordered' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/collections/:id/generate-seo — approve-first meta for this
// collection page (returns a suggestion, does NOT save). Grounded in the real
// pieces the collection gathers.
router.post('/:id/generate-seo', aiRateLimit, async (req, res) => {
  try {
    const collection = await Collection.findById(req.params.id).lean();
    if (!collection) return res.status(404).json({ error: 'Not found' });

    const items = await Product.find({ collections: collection._id, status: 'active' })
      .select('name').limit(12).lean();

    const seo = await generateSEO({
      kind: 'collection',
      name: req.body.name || collection.name,
      description: req.body.description || collection.description || '',
      items: items.map(p => p.name),
      guidance: req.body.guidance || '',
    });

    res.json({
      // Clamp to the model's maxlength (70/165) so applying can't trip validation.
      seo: {
        metaTitle: String(seo.metaTitle || '').slice(0, 70),
        metaDescription: String(seo.metaDescription || '').slice(0, 165),
        keywords: seo.keywords,
      },
      message: 'SEO generated. Review and save to apply.',
    });
  } catch (err) {
    console.error('[collection generate-seo] error:', err.message);
    if (err instanceof AIServiceError) {
      return res.status(503).json({ error: 'AI SEO generation is temporarily unavailable. Fill the fields manually, or try again in a moment.' });
    }
    res.status(500).json({ error: 'Could not generate SEO. Please try again or fill in manually.' });
  }
});

module.exports = router;
