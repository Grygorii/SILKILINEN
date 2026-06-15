const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const Category = require('../models/Category');
const Product = require('../models/Product');
const { requireAuth } = require('../middleware/auth');
const { generateSEO, AIServiceError } = require('../services/aiText');

// All routes require admin auth
router.use(requireAuth);

// Same budget as the product SEO endpoint — bounded AI calls per hour.
const aiRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI generation calls in the last hour. Wait a few minutes and try again.' },
});

// GET /api/admin/categories
// Lists every category (active + archived) with product count attached.
// Optional ?status=active|archived filter.
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const categories = await Category.find(filter).sort({ displayOrder: 1, createdAt: 1 }).lean();

    const counts = await Product.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);
    const countMap = {};
    counts.forEach(c => { countMap[c._id] = c.count; });

    const enriched = categories.map(c => ({
      ...c,
      productCount: countMap[c.slug] || 0,
    }));

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/categories
router.post('/', async (req, res) => {
  try {
    const { slug, label, description, heroImage, displayOrder, status, metaTitle, metaDescription } = req.body;
    if (!slug || !label) {
      return res.status(400).json({ error: 'slug and label are required' });
    }
    const category = new Category({ slug, label, description, heroImage, displayOrder, status, metaTitle, metaDescription });
    await category.save();
    res.status(201).json(category);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'A category with this slug already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/categories/:id
router.get('/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).lean();
    if (!category) return res.status(404).json({ error: 'Not found' });
    const productCount = await Product.countDocuments({ category: category.slug });
    res.json({ ...category, productCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/categories/:id
// Slug is intentionally immutable — changing it would orphan every product
// that references the old slug. To "rename" the slug, archive this category
// and create a new one.
router.patch('/:id', async (req, res) => {
  try {
    const allowed = ['label', 'description', 'heroImage', 'displayOrder', 'status', 'metaTitle', 'metaDescription'];
    const updates = {};
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }
    const category = await Category.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!category) return res.status(404).json({ error: 'Not found' });
    res.json(category);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/categories/:id  (soft archive)
// Guard: if products still reference this category slug, refuse to archive
// (409) unless the caller passes ?reassignTo=<slug> to move them first.
// Without the guard, archiving silently orphaned products to a dead filter.
router.delete('/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ error: 'Not found' });

    const productCount = await Product.countDocuments({ category: category.slug });
    const reassignTo = req.query.reassignTo;

    if (productCount > 0 && !reassignTo) {
      return res.status(409).json({
        error: 'category_has_products',
        productCount,
        message: `${productCount} product${productCount > 1 ? 's are' : ' is'} still tagged "${category.slug}". Reassign them to another category before archiving.`,
      });
    }

    if (productCount > 0 && reassignTo) {
      const target = await Category.findOne({ slug: reassignTo, status: 'active' });
      if (!target) return res.status(400).json({ error: 'reassignTo category not found or not active' });
      await Product.updateMany({ category: category.slug }, { $set: { category: reassignTo } });
    }

    category.status = 'archived';
    await category.save();
    res.json({ message: 'Archived', category });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/categories/:id/permanent — hard delete (removes the record).
// Same product guard as archive: refuse (409) if products are still tagged,
// unless ?reassignTo=<slug> is given to move them first.
router.delete('/:id/permanent', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ error: 'Not found' });

    const productCount = await Product.countDocuments({ category: category.slug });
    const reassignTo = req.query.reassignTo;

    if (productCount > 0 && !reassignTo) {
      return res.status(409).json({
        error: 'category_has_products',
        productCount,
        message: `${productCount} product${productCount > 1 ? 's are' : ' is'} still tagged "${category.slug}". Reassign them to another category before deleting.`,
      });
    }
    if (productCount > 0 && reassignTo) {
      const target = await Category.findOne({ slug: reassignTo });
      if (!target) return res.status(400).json({ error: 'reassignTo category not found' });
      await Product.updateMany({ category: category.slug }, { $set: { category: reassignTo } });
    }

    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/categories/:id/generate-seo — generate a meta title +
// description for this category page (approve-first: returns a suggestion, does
// NOT save). Accepts current form state so the founder needn't save first.
router.post('/:id/generate-seo', aiRateLimit, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).lean();
    if (!category) return res.status(404).json({ error: 'Not found' });

    // A sample of the pieces this category lists — real context so the copy is
    // about what's actually on the page, not invented.
    const items = await Product.find({ category: category.slug, status: 'active' })
      .select('name').limit(12).lean();

    const seo = await generateSEO({
      kind: 'category',
      name: req.body.label || category.label,
      description: req.body.description || category.description || '',
      items: items.map(p => p.name),
      guidance: req.body.guidance || '',
    });

    res.json({
      // Clamp to the model's maxlength (70/165) so applying the draft can't
      // trip schema validation ("Apply failed").
      seo: {
        metaTitle: String(seo.metaTitle || '').slice(0, 70),
        metaDescription: String(seo.metaDescription || '').slice(0, 165),
        keywords: seo.keywords,
      },
      message: 'SEO generated. Review and save to apply.',
    });
  } catch (err) {
    console.error('[category generate-seo] error:', err.message);
    if (err instanceof AIServiceError) {
      return res.status(503).json({ error: 'AI SEO generation is temporarily unavailable. Fill the fields manually, or try again in a moment.' });
    }
    res.status(500).json({ error: 'Could not generate SEO. Please try again or fill in manually.' });
  }
});

module.exports = router;
