const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const sharp = require('sharp');
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

const CONTENT_SPECS = {
  homepage_hero_image:           { width: 2400, height: 1200 },
  homepage_story_image:          { width: 1200, height: 1500 },
  category_tile_robes_image:     { width: 800,  height: 1000 },
  category_tile_dresses_image:   { width: 800,  height: 1000 },
  category_tile_shorts_image:    { width: 800,  height: 1000 },
  category_tile_shirts_image:    { width: 800,  height: 1000 },
  category_tile_scarves_image:   { width: 800,  height: 1000 },
  about_hero_image:              { width: 2400, height: 1200 },
  about_story_image_1:           { width: 1200, height: 1500 },
  about_story_image_2:           { width: 1200, height: 1500 },
  instagram_image_1:             { width: 1080, height: 1080 },
  instagram_image_2:             { width: 1080, height: 1080 },
  instagram_image_3:             { width: 1080, height: 1080 },
  instagram_image_4:             { width: 1080, height: 1080 },
  instagram_image_5:             { width: 1080, height: 1080 },
  instagram_image_6:             { width: 1080, height: 1080 },
};

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
    const key = req.query.key || '';
    const spec = CONTENT_SPECS[key];

    // Validate aspect ratio if a spec exists for this slot
    if (spec) {
      const metadata = await sharp(req.file.buffer).metadata();
      const expectedRatio = spec.width / spec.height;
      const actualRatio = metadata.width / metadata.height;
      const ratioDiff = Math.abs(expectedRatio - actualRatio) / expectedRatio;

      if (ratioDiff > 0.1) {
        return res.status(400).json({
          error: `Wrong aspect ratio — expected ${spec.width}×${spec.height}, got ${metadata.width}×${metadata.height}. Please crop or regenerate the image.`,
        });
      }
    }

    // Use eager transform to store correctly-sized derived image
    const uploadOptions = {
      folder: `silkilinen/${section}`,
      resource_type: 'image',
    };
    if (spec) {
      uploadOptions.eager = [{
        width: spec.width,
        height: spec.height,
        crop: 'fill',
        gravity: 'auto',
        quality: 'auto',
        fetch_format: 'auto',
      }];
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(uploadOptions,
        (error, result) => error ? reject(error) : resolve(result)
      );
      stream.end(req.file.buffer);
    });

    const url = (spec && result.eager?.[0]?.secure_url) || result.secure_url;
    res.json({ url, publicId: result.public_id });
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
