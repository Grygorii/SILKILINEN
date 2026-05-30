const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const Product = require('../models/Product');
const { requireAuth } = require('../middleware/auth');

// All routes require admin auth
router.use(requireAuth);

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
    const { slug, label, description, heroImage, displayOrder, status } = req.body;
    if (!slug || !label) {
      return res.status(400).json({ error: 'slug and label are required' });
    }
    const category = new Category({ slug, label, description, heroImage, displayOrder, status });
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
    const allowed = ['label', 'description', 'heroImage', 'displayOrder', 'status'];
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

module.exports = router;
