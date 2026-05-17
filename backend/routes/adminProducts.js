const express = require('express');
const router = express.Router();
const multer = require('multer');
const jwt = require('jsonwebtoken');
const cloudinary = require('cloudinary').v2;
const Product = require('../models/Product');
const { requireAuth } = require('../middleware/auth');
const { generateProductSEO, AIServiceError } = require('../services/aiText');
const { SLOT_KEYS } = require('../config/imageSlots');
const { SLUGS: CATEGORY_SLUGS } = require('../config/categories');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const imgUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Images only'));
  },
});

const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (file.mimetype.startsWith('video/')) cb(null, true);
    else cb(new Error('Videos only'));
  },
});

function uploadBuffer(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
    stream.end(buffer);
  });
}

// Fire-and-forget SEO auto-generation for products with missing fields
function autoGenerateSEO(product) {
  if (product.metaTitle && product.metaDescription) return;
  generateProductSEO(product)
    .then(seo => Product.findByIdAndUpdate(product._id, {
      metaTitle: product.metaTitle || seo.metaTitle,
      metaDescription: product.metaDescription || seo.metaDescription,
      slug: product.slug || seo.slug,
      keywords: product.keywords?.length ? product.keywords : seo.keywords,
      altTextTemplate: product.altTextTemplate || seo.altTextTemplate || '',
    }))
    .catch(err => console.error(`[Auto-SEO] Failed for ${product._id}: ${err.message}`));
}

// ── Validation helpers ─────────────────────────────────────────────────────────

// Fields that must be present on every save (draft included).
function validateForSave(data) {
  const fields = [];
  if (!data.name?.trim()) {
    fields.push({ field: 'name', label: 'Product name', message: 'Product name is required' });
  }
  const price = Number(data.price);
  if (!price || price <= 0) {
    fields.push({ field: 'price', label: 'Price', message: 'Price must be greater than 0' });
  }
  return fields;
}

// Additional fields required before transitioning to 'active'.
function validateForPublish(product) {
  const fields = [];
  if (!product.name?.trim()) {
    fields.push({ field: 'name', label: 'Product name', message: 'Product name is required' });
  }
  if (!product.price || product.price <= 0) {
    fields.push({ field: 'price', label: 'Price', message: 'Price must be greater than 0' });
  }
  if (!product.category || !CATEGORY_SLUGS.includes(product.category)) {
    fields.push({ field: 'category', label: 'Category', message: 'Valid category is required' });
  }
  if (!product.description?.trim() || product.description.trim().length < 50) {
    fields.push({ field: 'description', label: 'Description', message: 'Description must be at least 50 characters' });
  }
  if (!product.images?.length) {
    fields.push({ field: 'images', label: 'Product images', message: 'At least one image is required' });
  }
  if (!product.variants?.length) {
    fields.push({ field: 'variants', label: 'Variants', message: 'At least one variant is required' });
  }
  return fields;
}

// All routes require admin auth
router.use(requireAuth);

// GET /api/admin/products — list with filters, sort, and pagination
router.get('/', async function(req, res) {
  try {
    const {
      status, search, stock, category, issues,
      sort = 'updatedAt', dir = 'desc',
      page = 1, limit = 50,
    } = req.query;
    const filter = {};

    if (status && status !== 'all') {
      const allowed = ['draft', 'active', 'sold_out', 'archived'];
      const statuses = status.split(',').filter(s => allowed.includes(s));
      if (statuses.length) filter.status = { $in: statuses };
    }

    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: re }, { description: re }];
    }

    if (category && category !== 'all') filter.category = category;

    if (stock === 'in') filter.totalStock = { $gt: 0 };
    else if (stock === 'out') filter.totalStock = { $lte: 0 };
    else if (stock === 'low') filter.totalStock = { $gt: 0, $lt: 5 };

    if (issues === 'no-images')      filter['images.0'] = { $exists: false };
    else if (issues === 'no-seo')    filter.$or = [{ metaTitle: { $in: [null, ''] } }];
    else if (issues === 'no-variants') filter['variants.0'] = { $exists: false };
    else if (issues === 'no-description') filter.description = { $in: [null, ''] };

    const allowedSorts = ['updatedAt', 'createdAt', 'name', 'price', 'totalStock'];
    const sortField = allowedSorts.includes(sort) ? sort : 'updatedAt';
    const sortObj = { [sortField]: dir === 'asc' ? 1 : -1 };

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      Product.find(filter).sort(sortObj).skip(skip).limit(limitNum),
      Product.countDocuments(filter),
    ]);

    res.json({ products, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/products/:id/preview-token — generate a 1-hour signed preview URL
router.get('/:id/preview-token', async function(req, res) {
  try {
    const product = await Product.findById(req.params.id).select('_id');
    if (!product) return res.status(404).json({ error: 'Not found' });

    const secret = process.env.PREVIEW_TOKEN_SECRET || process.env.JWT_SECRET;
    const token = jwt.sign({ productId: String(product._id) }, secret, { expiresIn: '1h' });
    const baseUrl = process.env.FRONTEND_URL || 'https://silkilinen.com';
    const url = `${baseUrl}/preview/${product._id}?token=${token}`;
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

    res.json({ token, url, expiresAt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/products/:id — single product, any status
router.get('/:id', async function(req, res) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Not found' });
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/products — create draft
router.post('/', async function(req, res) {
  try {
    // Empty-draft path: create immediately with schema defaults, bypass app-level validators
    if (req.body.createEmptyDraft) {
      const product = new Product({
        status: 'draft',
        origin: 'Made in Donegal',
        lastUpdatedBy: req.user.userId,
      });
      await product.save();
      return res.status(201).json(product);
    }

    const saveErrors = validateForSave(req.body);
    if (saveErrors.length) {
      return res.status(400).json({ error: 'ValidationError', fields: saveErrors });
    }
    const product = await Product.create({
      ...req.body,
      status: req.body.status || 'draft',
      lastUpdatedBy: req.user.userId,
    });
    autoGenerateSEO(product);
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/admin/products/:id — full update (variants included, images managed separately)
router.put('/:id', async function(req, res) {
  try {
    const { images: _images, ...rest } = req.body;

    const saveErrors = validateForSave(rest);
    if (saveErrors.length) {
      return res.status(400).json({ error: 'ValidationError', fields: saveErrors });
    }

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Not found' });

    const oldStatus = product.status;
    Object.assign(product, rest, { lastUpdatedBy: req.user.userId });

    if (product.status === 'active' && oldStatus !== 'active') {
      const publishErrors = validateForPublish(product);
      if (publishErrors.length) {
        return res.status(400).json({ error: 'ValidationError', fields: publishErrors });
      }
    }

    const isDraft = product.status === 'draft';
    await product.save({ validateBeforeSave: !isDraft });
    autoGenerateSEO(product);
    res.json(product);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const fields = Object.entries(err.errors).map(([field, e]) => ({
        field, label: field, message: e.message,
      }));
      return res.status(400).json({ error: 'ValidationError', fields });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/products/:id/quick-update — inline edit price / status / stock
router.patch('/:id/quick-update', async function(req, res) {
  try {
    const { price, totalStock, status } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Not found' });

    if (typeof price === 'number') {
      if (price < 0) return res.status(400).json({ error: 'Price must be positive' });
      product.price = Math.round(price * 100) / 100;
    }

    if (typeof totalStock === 'number') {
      if (product.variants?.length > 0) {
        return res.status(400).json({ error: 'Has variants — edit stock on the product page' });
      }
      product.totalStock = Math.max(0, Math.floor(totalStock));
      product.inStock = product.totalStock > 0;
    }

    if (status) {
      const allowed = ['draft', 'active', 'sold_out', 'archived'];
      if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
      if (status === 'active' && product.status !== 'active') {
        const publishErrors = validateForPublish(product);
        if (publishErrors.length) return res.status(400).json({ error: 'ValidationError', fields: publishErrors });
      }
      product.status = status;
    }

    product.lastUpdatedBy = req.user.userId;
    await product.save({ validateBeforeSave: false });
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Bulk endpoints — all must come BEFORE /:id param routes ───────────────────

// POST /api/admin/products/bulk-publish
router.post('/bulk-publish', async function(req, res) {
  try {
    const { productIds } = req.body;
    if (!Array.isArray(productIds) || productIds.length === 0) return res.status(400).json({ error: 'No products selected' });
    if (productIds.length > 100) return res.status(400).json({ error: 'Max 100 at a time' });

    const products = await Product.find({ _id: { $in: productIds } });
    const cantPublish = products
      .map(p => ({ name: p.name, errors: validateForPublish(p) }))
      .filter(p => p.errors.length > 0);

    if (cantPublish.length > 0) {
      return res.status(400).json({ error: 'Some products cannot be published', details: cantPublish });
    }

    const result = await Product.updateMany({ _id: { $in: productIds } }, { $set: { status: 'active' } });
    res.json({ updated: result.modifiedCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/products/bulk-archive
router.post('/bulk-archive', async function(req, res) {
  try {
    const { productIds } = req.body;
    if (!Array.isArray(productIds) || productIds.length === 0) return res.status(400).json({ error: 'No products selected' });
    const result = await Product.updateMany({ _id: { $in: productIds } }, { $set: { status: 'archived' } });
    res.json({ updated: result.modifiedCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/products/bulk-delete — hard delete where safe, archive rest
router.post('/bulk-delete', async function(req, res) {
  try {
    const { productIds, confirmation } = req.body;
    if (confirmation !== 'DELETE') return res.status(400).json({ error: 'Confirmation phrase required' });
    if (!Array.isArray(productIds) || productIds.length === 0) return res.status(400).json({ error: 'No products selected' });

    const Order = require('../models/Order');
    const products = await Product.find({ _id: { $in: productIds } });
    const safeIds = [];
    const archiveIds = [];

    for (const product of products) {
      const hasOrder = await Order.exists({
        $or: [
          { 'items.productId': product._id },
          { 'items.name': product.name },
        ],
      });
      if (hasOrder) archiveIds.push(product._id);
      else safeIds.push(product._id);
    }

    if (safeIds.length > 0) await Product.deleteMany({ _id: { $in: safeIds } });
    if (archiveIds.length > 0) await Product.updateMany({ _id: { $in: archiveIds } }, { $set: { status: 'archived' } });

    res.json({
      deleted: safeIds.length,
      archivedInstead: archiveIds.length,
      message: archiveIds.length > 0
        ? `Deleted ${safeIds.length}. ${archiveIds.length} archived (had order history).`
        : `Deleted ${safeIds.length} products.`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/products/bulk-category
router.post('/bulk-category', async function(req, res) {
  try {
    const { productIds, category } = req.body;
    const { SLUGS } = require('../config/categories');
    if (!SLUGS.includes(category)) return res.status(400).json({ error: 'Invalid category' });
    if (!Array.isArray(productIds) || productIds.length === 0) return res.status(400).json({ error: 'No products selected' });
    const result = await Product.updateMany({ _id: { $in: productIds } }, { $set: { category } });
    res.json({ updated: result.modifiedCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/products/bulk-discount — apply % off, set compareAtPrice
router.post('/bulk-discount', async function(req, res) {
  try {
    const { productIds, discountPercent } = req.body;
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 90) {
      return res.status(400).json({ error: 'Discount must be 0–90%' });
    }
    if (!Array.isArray(productIds) || productIds.length === 0) return res.status(400).json({ error: 'No products selected' });

    const products = await Product.find({ _id: { $in: productIds } });
    for (const product of products) {
      product.compareAtPrice = product.price;
      product.price = Math.round(product.price * (1 - discountPercent / 100) * 100) / 100;
      await product.save({ validateBeforeSave: false });
    }
    res.json({ updated: products.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/products/export — CSV download
router.post('/export', async function(req, res) {
  try {
    const { productIds } = req.body;
    if (!Array.isArray(productIds) || productIds.length === 0) return res.status(400).json({ error: 'No products selected' });

    const products = await Product.find({ _id: { $in: productIds } }).lean();
    const rows = [
      ['ID', 'Name', 'Status', 'Category', 'Price', 'CompareAtPrice', 'TotalStock', 'Variants', 'Images', 'Created'].join(','),
      ...products.map(p => [
        p._id,
        `"${(p.name || '').replace(/"/g, '""')}"`,
        p.status,
        p.category,
        p.price,
        p.compareAtPrice || '',
        p.totalStock || 0,
        (p.variants || []).length,
        (p.images || []).length,
        new Date(p.createdAt).toISOString().split('T')[0],
      ].join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="products-${Date.now()}.csv"`);
    res.send(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/products/bulk-generate-seo — generate SEO for all products missing it
router.post('/bulk-generate-seo', async function(req, res) {
  try {
    const products = await Product.find({
      status: { $ne: 'archived' },
      $or: [
        { metaTitle: { $in: [null, ''] } },
        { metaDescription: { $in: [null, ''] } },
      ],
    }).select('name description category materialComposition colours price metaTitle metaDescription slug keywords altTextTemplate');

    const total = products.length;
    if (total === 0) return res.json({ updated: 0, total: 0, message: 'All products already have SEO.' });

    let updated = 0;
    const errors = [];

    for (let i = 0; i < products.length; i += 5) {
      const batch = products.slice(i, i + 5);
      const results = await Promise.allSettled(batch.map(async (product) => {
        const seo = await generateProductSEO(product);
        await Product.findByIdAndUpdate(product._id, {
          metaTitle: product.metaTitle || seo.metaTitle,
          metaDescription: product.metaDescription || seo.metaDescription,
          slug: product.slug || seo.slug,
          keywords: product.keywords?.length ? product.keywords : seo.keywords,
          altTextTemplate: product.altTextTemplate || seo.altTextTemplate || '',
        });
      }));
      for (let j = 0; j < results.length; j++) {
        if (results[j].status === 'fulfilled') updated++;
        else errors.push(`${batch[j].name}: ${results[j].reason?.message}`);
      }
    }

    res.json({
      updated,
      total,
      errors,
      message: `SEO generated for ${updated} of ${total} product${total !== 1 ? 's' : ''}.`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/products/:id/generate-seo — generate SEO for one product (no auto-save)
router.post('/:id/generate-seo', async function(req, res) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Accept current form state from frontend so admin doesn't need to save first
    const seo = await generateProductSEO({
      name:                req.body.name                || product.name,
      description:         req.body.description         || product.description,
      category:            req.body.category            || product.category,
      materialComposition: req.body.materialComposition || product.materialComposition,
      colours:             req.body.colours             || product.colours,
      price:               req.body.price               || product.price,
      keywords:            product.keywords             || [],
    });

    res.json({ seo, cost: 0.0005, message: 'SEO generated. Review and save to apply.' });
  } catch (err) {
    console.error('[generate-seo] error:', err);
    if (err instanceof AIServiceError) {
      return res.status(503).json({ error: 'AI SEO generation is temporarily unavailable. Please fill in SEO fields manually, or try again in a moment.' });
    }
    res.status(500).json({ error: 'Could not generate SEO. Please try again or fill in manually.' });
  }
});

// DELETE /api/admin/products/:id — hard delete if no order history, else archive
router.delete('/:id', async function(req, res) {
  try {
    const { confirmation } = req.body;
    if (confirmation !== 'DELETE') return res.status(400).json({ error: 'Confirmation required' });

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Not found' });

    const Order = require('../models/Order');
    const hasOrder = await Order.exists({
      $or: [
        { 'items.productId': product._id },
        { 'items.name': product.name },
      ],
    });

    if (hasOrder) {
      product.status = 'archived';
      product.lastUpdatedBy = req.user.userId;
      await product.save({ validateBeforeSave: false });
      return res.json({ deleted: false, archived: true, message: 'Product had order history — archived instead of deleted' });
    }

    await Product.deleteOne({ _id: product._id });
    res.json({ deleted: true, message: 'Product permanently deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/products/:id/duplicate — clone as draft
router.post('/:id/duplicate', async function(req, res) {
  try {
    const src = await Product.findById(req.params.id);
    if (!src) return res.status(404).json({ error: 'Not found' });

    const obj = src.toObject();
    delete obj._id;
    delete obj.createdAt;
    delete obj.updatedAt;
    delete obj.__v;
    delete obj.slug;            // will be regenerated
    delete obj.altTextTemplate; // prevents old product's alt text bleeding into new uploads
    delete obj.metaTitle;
    delete obj.metaDescription;
    delete obj.keywords;
    obj.name = `${src.name} (copy)`;
    obj.status = 'draft';
    obj.lastUpdatedBy = req.user.userId;

    const copy = await Product.create(obj);
    res.status(201).json(copy);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Image routes (order matters: literals before params) ───────────────────────

// PUT /api/admin/products/:id/images/reorder — reorder images
router.put('/:id/images/reorder', async function(req, res) {
  try {
    const { order } = req.body; // array of imageIds in new order
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array' });

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Not found' });

    order.forEach((imageId, idx) => {
      const img = product.images.id(imageId);
      if (img) img.order = idx;
    });
    product.images.sort((a, b) => a.order - b.order);
    product.lastUpdatedBy = req.user.userId;
    await product.save({ validateBeforeSave: false });
    res.json(product.images);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/products/:id/images/url — add already-uploaded image by URL (AI approval flow)
router.post('/:id/images/url', async function(req, res) {
  try {
    const { url, cloudinaryPublicId, alt, slot } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Not found' });

    const validSlot = slot && SLOT_KEYS.includes(slot) ? slot : undefined;

    // Bump any existing occupant of the target slot to unslotted
    if (validSlot) {
      const occupant = product.images.find(i => i.slot === validSlot);
      if (occupant) occupant.slot = undefined;
      if (validSlot === 'hero') {
        product.images.forEach(i => { i.isPrimary = false; });
      }
    }

    const defaultAlt = alt || (product.altTextTemplate
      ? product.altTextTemplate.replace('{position}', validSlot || 'product photo')
      : `${product.name} — handmade silk by SILKILINEN, Donegal`);

    product.images.push({
      url,
      alt: defaultAlt,
      isPrimary: product.images.length === 0 || validSlot === 'hero',
      order: product.images.length,
      cloudinaryPublicId: cloudinaryPublicId || '',
      slot: validSlot,
    });
    product.lastUpdatedBy = req.user.userId;
    await product.save({ validateBeforeSave: false });
    res.json(product.images);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/products/:id/images — upload one or more image files
router.post('/:id/images', imgUpload.array('images', 20), async function(req, res) {
  try {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files' });
    if (!process.env.CLOUDINARY_CLOUD_NAME) return res.status(503).json({ error: 'Cloudinary not configured' });

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Not found' });

    const slot = req.body.slot && SLOT_KEYS.includes(req.body.slot) ? req.body.slot : undefined;

    // If uploading to a slot, remove the existing image in that slot first
    if (slot) {
      const existing = product.images.find(img => img.slot === slot);
      if (existing) {
        if (existing.cloudinaryPublicId) {
          await cloudinary.uploader.destroy(existing.cloudinaryPublicId).catch(() => {});
        }
        product.images.pull(existing._id);
      }
      // Hero slot owns isPrimary
      if (slot === 'hero') {
        product.images.forEach(img => { img.isPrimary = false; });
      }
    }

    // For slot uploads use only the first file; for unslotted allow all
    const filesToProcess = slot ? [req.files[0]] : req.files;

    for (const file of filesToProcess) {
      const result = await uploadBuffer(file.buffer, {
        folder: `silkilinen/products/${req.params.id}`,
        resource_type: 'image',
        transformation: [{ width: 1200, height: 1500, crop: 'fill', gravity: 'auto' }],
      });
      const defaultAlt = product.altTextTemplate
        ? product.altTextTemplate.replace('{position}', slot || 'product photo')
        : `${product.name} — handmade silk by SILKILINEN, Donegal`;
      product.images.push({
        url: result.secure_url,
        alt: defaultAlt,
        isPrimary: product.images.length === 0 || slot === 'hero',
        order: product.images.length,
        cloudinaryPublicId: result.public_id,
        slot,
      });
    }

    product.lastUpdatedBy = req.user.userId;
    await product.save({ validateBeforeSave: false });
    res.json(product.images);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/products/:id/images/:imageId/slot — assign or unslot an image
router.patch('/:id/images/:imageId/slot', requireAuth, async function(req, res) {
  try {
    const { slot } = req.body; // null/undefined to unslot; valid key to slot
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Not found' });

    const img = product.images.id(req.params.imageId);
    if (!img) return res.status(404).json({ error: 'Image not found' });

    const validSlot = slot && SLOT_KEYS.includes(slot) ? slot : null;

    if (validSlot) {
      // Bump any existing occupant of the target slot back to unslotted
      const occupant = product.images.find(
        i => i.slot === validSlot && String(i._id) !== req.params.imageId,
      );
      if (occupant) occupant.slot = undefined;

      if (validSlot === 'hero') {
        product.images.forEach(i => { i.isPrimary = false; });
        img.isPrimary = true;
      }
    }

    img.slot = validSlot || undefined;
    product.lastUpdatedBy = req.user.userId;
    await product.save({ validateBeforeSave: false });
    res.json(product.images);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/products/:id/images/:imageId/primary — set as primary
router.put('/:id/images/:imageId/primary', async function(req, res) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Not found' });

    product.images.forEach(img => {
      img.isPrimary = String(img._id) === req.params.imageId;
    });
    product.lastUpdatedBy = req.user.userId;
    await product.save({ validateBeforeSave: false });
    res.json(product.images);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/products/:id/images/:imageId — update alt text / associatedColour
router.put('/:id/images/:imageId', async function(req, res) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Not found' });

    const img = product.images.id(req.params.imageId);
    if (!img) return res.status(404).json({ error: 'Image not found' });

    if (req.body.alt !== undefined) img.alt = req.body.alt;
    if (req.body.associatedColour !== undefined) img.associatedColour = req.body.associatedColour;
    product.lastUpdatedBy = req.user.userId;
    await product.save({ validateBeforeSave: false });
    res.json(product.images);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/products/:id/images/:imageId — remove image
router.delete('/:id/images/:imageId', async function(req, res) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Not found' });

    const img = product.images.id(req.params.imageId);
    if (!img) return res.status(404).json({ error: 'Image not found' });

    if (img.cloudinaryPublicId && process.env.CLOUDINARY_CLOUD_NAME) {
      await cloudinary.uploader.destroy(img.cloudinaryPublicId).catch(() => {});
    }

    const wasPrimary = img.isPrimary;
    product.images.pull(req.params.imageId);

    if (wasPrimary && product.images.length > 0) {
      product.images[0].isPrimary = true;
    }
    product.lastUpdatedBy = req.user.userId;
    await product.save({ validateBeforeSave: false });
    res.json(product.images);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/products/:id/video — upload product video
router.post('/:id/video', videoUpload.single('video'), async function(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    if (!process.env.CLOUDINARY_CLOUD_NAME) return res.status(503).json({ error: 'Cloudinary not configured' });

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Not found' });

    if (product.productVideo?.cloudinaryPublicId) {
      await cloudinary.uploader.destroy(product.productVideo.cloudinaryPublicId, { resource_type: 'video' }).catch(() => {});
    }

    const result = await uploadBuffer(req.file.buffer, {
      folder: `silkilinen/products/${req.params.id}`,
      resource_type: 'video',
    });

    const thumbnailUrl = result.secure_url
      .replace('/video/upload/', '/video/upload/f_jpg,so_1/')
      .replace(/\.[^.]+$/, '.jpg');

    product.productVideo = { url: result.secure_url, thumbnailUrl, cloudinaryPublicId: result.public_id };
    product.lastUpdatedBy = req.user.userId;
    await product.save({ validateBeforeSave: false });
    res.json({ productVideo: product.productVideo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/products/:id/video — remove product video
router.delete('/:id/video', async function(req, res) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Not found' });

    if (product.productVideo?.cloudinaryPublicId) {
      await cloudinary.uploader.destroy(product.productVideo.cloudinaryPublicId, { resource_type: 'video' }).catch(() => {});
    }

    await Product.findByIdAndUpdate(req.params.id, {
      $unset: { productVideo: 1 },
      lastUpdatedBy: req.user.userId,
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
