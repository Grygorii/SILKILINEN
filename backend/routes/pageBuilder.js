const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2; // configured at load by adminProducts
const PageLayout = require('../models/PageLayout');
const { requireAuth } = require('../middleware/auth');
const { detectImageType } = require('../utils/fileSignature');

const adminRouter = express.Router();
const publicRouter = express.Router();
const imgUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

adminRouter.use(requireAuth);

// POST /api/admin/page-builder/upload — upload an image for a block, returns { url }.
adminRouter.post('/upload', imgUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    if (!process.env.CLOUDINARY_CLOUD_NAME) return res.status(503).json({ error: 'Cloudinary not configured' });
    if (!detectImageType(req.file.buffer)) return res.status(400).json({ error: 'Not a recognised image (jpeg/png/gif/webp).' });
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream({ folder: 'silkilinen/pages', resource_type: 'image' }, (err, r) => (err ? reject(err) : resolve(r))).end(req.file.buffer);
    });
    res.json({ url: result.secure_url });
  } catch (err) {
    console.error('[page-builder] upload:', err.message);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// GET /api/admin/page-builder/:slug — load the layout for editing (any status).
adminRouter.get('/:slug', async (req, res) => {
  try {
    const layout = await PageLayout.findOne({ slug: req.params.slug }).lean();
    res.json(layout || { slug: req.params.slug, blocks: [], status: 'draft' });
  } catch (err) {
    console.error('[page-builder] load:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/page-builder/:slug — save blocks (+ optional status). Upserts.
adminRouter.put('/:slug', async (req, res) => {
  try {
    const blocks = Array.isArray(req.body.blocks) ? req.body.blocks : [];
    const update = { blocks, updatedBy: req.user.userId };
    if (req.body.status === 'published' || req.body.status === 'draft') update.status = req.body.status;
    const layout = await PageLayout.findOneAndUpdate(
      { slug: req.params.slug },
      { $set: update, $setOnInsert: { slug: req.params.slug } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    res.json(layout);
  } catch (err) {
    console.error('[page-builder] save:', err.message);
    res.status(500).json({ error: 'Could not save the layout.' });
  }
});

// GET /api/page-layout/:slug — PUBLISHED layout only, for the storefront. Returns
// null (200) when there's no published layout, so the page falls back to its
// existing hardcoded version.
publicRouter.get('/:slug', async (req, res) => {
  try {
    const layout = await PageLayout.findOne({ slug: req.params.slug, status: 'published' })
      .select('slug blocks updatedAt').lean();
    res.json(layout || null);
  } catch (err) {
    console.error('[page-layout] public:', err.message);
    res.json(null);
  }
});

module.exports = { adminRouter, publicRouter };
