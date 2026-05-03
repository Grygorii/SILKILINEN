const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const SiteContent = require('../models/SiteContent');
const { requireAuth } = require('../middleware/auth');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

function toObj(items) {
  const obj = {};
  for (const item of items) {
    obj[item.key] = {
      value: item.value,
      altText: item.altText,
      caption: item.caption,
      type: item.type,
      label: item.label,
      section: item.section,
      order: item.order,
    };
  }
  return obj;
}

// GET /api/content — all active content as key→value object
router.get('/', async function(req, res) {
  try {
    const items = await SiteContent.find({ active: true }).sort({ section: 1, order: 1 });
    res.json(toObj(items));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/content/all-admin — full records for admin UI
router.get('/all-admin', requireAuth, async function(req, res) {
  try {
    const items = await SiteContent.find().sort({ section: 1, order: 1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/content/upload — upload image to Cloudinary, return URL
router.post('/upload', requireAuth, upload.single('image'), async function(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const missingVars = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']
      .filter(v => !process.env[v]);
    if (missingVars.length) {
      console.error(`[UPLOAD] Missing env vars: ${missingVars.join(', ')}`);
      return res.status(503).json({ error: `Cloudinary not configured — missing: ${missingVars.join(', ')}` });
    }

    const section = req.query.section || 'content';

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `silkilinen/${section}`, resource_type: 'image' },
        (error, result) => error ? reject(error) : resolve(result)
      );
      stream.end(req.file.buffer);
    });

    res.json({ url: result.secure_url, publicId: result.public_id });
  } catch (err) {
    console.error('[UPLOAD] Cloudinary error:', err);
    res.status(500).json({ error: 'Upload failed', message: err.message });
  }
});

// GET /api/content/:section — content for a specific section
router.get('/:section', async function(req, res) {
  try {
    const items = await SiteContent.find({ section: req.params.section, active: true }).sort({ order: 1 });
    res.json(toObj(items));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/content/:key — admin update
router.put('/:key', requireAuth, async function(req, res) {
  try {
    const { value, altText, caption } = req.body;
    const update = { updatedBy: req.user?.id };
    if (value !== undefined) update.value = value;
    if (altText !== undefined) update.altText = altText;
    if (caption !== undefined) update.caption = caption;

    const item = await SiteContent.findOneAndUpdate({ key: req.params.key }, update, { new: true });
    if (!item) return res.status(404).json({ error: 'Content key not found' });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
