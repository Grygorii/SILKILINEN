const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const Product = require('../models/Product');
const { requireAuth } = require('../middleware/auth');
const { generateProductSEO } = require('../services/seoGenerator');
const { SLOT_KEYS } = require('../config/imageSlots');

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

// All routes require admin auth
router.use(requireAuth);

// GET /api/admin/products — list with filters and pagination
router.get('/', async function(req, res) {
  try {
    const { status, search, stock, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (status && status !== 'all') {
      const allowed = ['draft', 'active', 'sold_out', 'archived'];
      const statuses = status.split(',').filter(s => allowed.includes(s));
      if (statuses.length) filter.status = { $in: statuses };
    }

    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.name = re;
    }

    if (stock === 'in') filter.inStock = true;
    else if (stock === 'out') filter.inStock = false;
    else if (stock === 'low') {
      filter.variants = { $elemMatch: { stockLevel: { $gt: 0 }, $expr: { $lte: ['$stockLevel', '$lowStockThreshold'] } } };
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      Product.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limitNum),
      Product.countDocuments(filter),
    ]);

    res.json({ products, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/products/:id — single product, any status
router.get('/:id', async function(req, res) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/products — create draft
router.post('/', async function(req, res) {
  try {
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
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Not found' });

    Object.assign(product, rest, { lastUpdatedBy: req.user.userId });
    await product.save();
    autoGenerateSEO(product);
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/products/:id/generate-seo — generate SEO for one product (no auto-save)
router.post('/:id/generate-seo', async function(req, res) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Accept current form state from frontend so admin doesn't need to save first
    const data = {
      name: req.body.name || product.name,
      description: req.body.description || product.description,
      category: req.body.category || product.category,
      materialComposition: req.body.materialComposition || product.materialComposition,
      colours: req.body.colours || product.colours,
      price: req.body.price || product.price,
    };

    const seo = await generateProductSEO(data);
    res.json({ seo, cost: 0.001, message: 'SEO generated. Review and save to apply.' });
  } catch (err) {
    console.error('SEO generation error:', err);
    res.status(500).json({ error: 'Failed to generate SEO', details: err.message });
  }
});

// DELETE /api/admin/products/:id — soft delete (set status: archived)
router.delete('/:id', async function(req, res) {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { status: 'archived', lastUpdatedBy: req.user.userId },
      { new: true }
    );
    if (!product) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    delete obj.slug; // will be regenerated
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
    await product.save();
    res.json(product.images);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/products/:id/images/url — add already-uploaded image by URL
router.post('/:id/images/url', async function(req, res) {
  try {
    const { url, cloudinaryPublicId, alt } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Not found' });

    const defaultAlt = alt || (product.altTextTemplate
      ? product.altTextTemplate.replace('{position}', 'product photo')
      : `${product.name} — handmade silk by SILKILINEN, Dublin`);

    product.images.push({
      url,
      alt: defaultAlt,
      isPrimary: product.images.length === 0,
      order: product.images.length,
      cloudinaryPublicId: cloudinaryPublicId || '',
    });
    product.lastUpdatedBy = req.user.userId;
    await product.save();
    res.json(product.images);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
        : `${product.name} — handmade silk by SILKILINEN, Dublin`;
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
    await product.save();
    res.json(product.images);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    await product.save();
    res.json(product.images);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    await product.save();
    res.json(product.images);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    await product.save();
    res.json(product.images);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    await product.save();
    res.json({ productVideo: product.productVideo });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
