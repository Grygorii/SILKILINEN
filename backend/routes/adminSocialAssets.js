const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { GoogleGenAI } = require('@google/genai');
const { cloudinary } = require('../utils/cloudinary');
const { requireAuth } = require('../middleware/auth');
const SocialAsset = require('../models/SocialAsset');
const SURFACES = require('../config/socialSurfaces');

const SURFACES_MAP = new Map(SURFACES.map(s => [s.key, s]));

const generateRateLimit = rateLimit({
  windowMs: 60_000,
  max: 10,
  message: { error: 'Rate limit: max 10 generations per minute. Slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function getGenAI() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set — add it to Railway environment variables.');
  }
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

function deliveredUrl(cloudinaryUrl, surface) {
  if (!surface.postResizeNeeded) return cloudinaryUrl;
  return cloudinaryUrl.replace(
    '/upload/',
    `/upload/c_fill,w_${surface.targetWidth},h_${surface.targetHeight}/`
  );
}

function downloadUrl(cloudinaryUrl, surface) {
  return cloudinaryUrl.replace(
    '/upload/',
    `/upload/c_fill,w_${surface.targetWidth},h_${surface.targetHeight},fl_attachment/`
  );
}

function formatAsset(asset, surface) {
  return {
    _id: asset._id,
    surface: asset.surface,
    prompt: asset.prompt,
    url: deliveredUrl(asset.cloudinaryUrl, surface),
    downloadUrl: downloadUrl(asset.cloudinaryUrl, surface),
    cloudinaryPublicId: asset.cloudinaryPublicId,
    width: surface.targetWidth,
    height: surface.targetHeight,
    aspect: asset.aspect,
    isWinner: asset.isWinner,
    generatedAt: asset.generatedAt,
  };
}

// GET /surfaces — return full surface registry
router.get('/surfaces', requireAuth, function(req, res) {
  res.json(SURFACES);
});

// GET / — winner + 8 recent candidates for a surface
router.get('/', requireAuth, async function(req, res) {
  try {
    const { surface: surfaceKey } = req.query;
    if (!surfaceKey || !SURFACES_MAP.has(surfaceKey)) {
      return res.status(400).json({ error: 'Invalid or missing surface key' });
    }
    const surface = SURFACES_MAP.get(surfaceKey);

    const [winner, candidates] = await Promise.all([
      SocialAsset.findOne({ surface: surfaceKey, isWinner: true }).lean(),
      SocialAsset.find({ surface: surfaceKey }).sort({ generatedAt: -1 }).limit(8).lean(),
    ]);

    res.json({
      winner: winner ? formatAsset(winner, surface) : null,
      candidates: candidates.map(a => formatAsset(a, surface)),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /generate — generate 4 candidates via Imagen 3
router.post('/generate', requireAuth, generateRateLimit, async function(req, res) {
  try {
    const { surface: surfaceKey, prompt } = req.body;
    if (!surfaceKey || !prompt) {
      return res.status(400).json({ error: 'surface and prompt are required' });
    }
    const surface = SURFACES_MAP.get(surfaceKey);
    if (!surface) {
      return res.status(400).json({ error: `Unknown surface: ${surfaceKey}` });
    }

    const genai = getGenAI();
    console.log(`[SocialAssets] Generating 4 candidates for ${surfaceKey}…`);

    const response = await genai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt,
      config: {
        numberOfImages: 4,
        aspectRatio: surface.geminiAspect,
        safetyFilterLevel: 'block_low_and_above',
        personGeneration: 'dont_allow',
      },
    });

    const generatedImages = response.generatedImages || [];
    console.log(`[SocialAssets] Imagen returned ${generatedImages.length}/4 images`);

    const savedAssets = [];
    for (const generatedImage of generatedImages) {
      const imageBytes = generatedImage.image?.imageBytes;
      if (!imageBytes) continue;

      const b64 = Buffer.from(imageBytes).toString('base64');
      const dataUri = `data:image/png;base64,${b64}`;

      const uploaded = await cloudinary.uploader.upload(dataUri, {
        folder: `silkilinen/social-assets/${surfaceKey}`,
        resource_type: 'image',
      });

      const asset = await SocialAsset.create({
        surface: surfaceKey,
        prompt,
        cloudinaryUrl: uploaded.secure_url,
        cloudinaryPublicId: uploaded.public_id,
        width: uploaded.width,
        height: uploaded.height,
        aspect: surface.aspect,
        isWinner: false,
        generatedAt: new Date(),
        generatedBy: req.user?.id || null,
      });

      savedAssets.push(formatAsset(asset.toObject(), surface));
    }

    const message = generatedImages.length < 4
      ? `Imagen returned ${generatedImages.length} of 4 candidates — some were refused by safety policy. Try editing the prompt or regenerating.`
      : null;

    res.json({ assets: savedAssets, message });
  } catch (err) {
    console.error('[SocialAssets] Generation error:', err.message);
    res.status(500).json({ error: err.message || 'Generation failed' });
  }
});

// POST /:id/set-winner
router.post('/:id/set-winner', requireAuth, async function(req, res) {
  try {
    const asset = await SocialAsset.findById(req.params.id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    await SocialAsset.updateMany({ surface: asset.surface }, { isWinner: false });
    asset.isWinner = true;
    await asset.save();

    const surface = SURFACES_MAP.get(asset.surface);
    res.json(formatAsset(asset.toObject(), surface));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id
router.delete('/:id', requireAuth, async function(req, res) {
  try {
    const asset = await SocialAsset.findById(req.params.id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    await cloudinary.uploader.destroy(asset.cloudinaryPublicId);
    await asset.deleteOne();

    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
