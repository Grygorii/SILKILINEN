const express = require('express');
const router = express.Router();
const { GoogleGenAI } = require('@google/genai');
const AiModel = require('../models/AiModel');
const { cloudinary } = require('../utils/cloudinary');
const { requireAuth } = require('../middleware/auth');
const { getTier, validateGeneration, computeFaceHash, identityMatchStatus } = require('../utils/imageValidation');

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-preview-image-generation';
const MAX_RETRIES = 2;

function getGenAI() {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

function uploadBuffer(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
    stream.end(buffer);
  });
}

router.get('/', requireAuth, async function(req, res) {
  try {
    const models = await AiModel.find().sort({ createdAt: 1 });
    res.json(models);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, async function(req, res) {
  try {
    const model = await AiModel.create(req.body);
    res.status(201).json(model);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', requireAuth, async function(req, res) {
  try {
    const model = await AiModel.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!model) return res.status(404).json({ error: 'Model not found' });
    res.json(model);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, async function(req, res) {
  try {
    const model = await AiModel.findByIdAndDelete(req.params.id);
    if (!model) return res.status(404).json({ error: 'Model not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate or regenerate the reference photo for a model
router.post('/:id/generate-reference', requireAuth, async function(req, res) {
  try {
    const aiModel = await AiModel.findById(req.params.id);
    if (!aiModel) return res.status(404).json({ error: 'Model not found' });
    if (aiModel.locked) return res.status(400).json({ error: 'Model is locked. Unlock before regenerating.' });
    if (!process.env.GEMINI_API_KEY) return res.status(400).json({ error: 'GEMINI_API_KEY is not configured' });

    const tierKey = req.body.tier && ['standard', 'hd', 'premium'].includes(req.body.tier)
      ? req.body.tier
      : 'premium'; // reference photos default to premium
    const tier = getTier(tierKey);

    const prompt = [
      aiModel.prompt,
      'Full-length portrait, model centred on a clean cream-white studio backdrop. Soft, even diffused daylight from the left.',
      'Style: La Perla, Eberjey, Lunya editorial aesthetic. No jewellery, no shoes. Barefoot.',
      'Professional luxury fashion photography. Sharp focus, no motion blur.',
    ].join('\n\n');

    const genai = getGenAI();

    let imageBuffer = null;
    let mimeType = 'image/jpeg';
    let lastValidation = null;
    let retries = 0;
    let retryCost = 0;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        retryCost += tier.estimatedCost;
        console.log(`[AI Models] Reference retry ${attempt} for ${aiModel.name}`);
      }

      let response;
      try {
        response = await genai.models.generateContent({
          model: GEMINI_MODEL,
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            responseModalities: ['IMAGE', 'TEXT'],
            imageConfig: { aspectRatio: '4:5', width: tier.width, height: tier.height },
          },
        });
      } catch (err) {
        if (attempt === MAX_RETRIES) throw err;
        continue;
      }

      let b64 = null;
      for (const part of (response.candidates?.[0]?.content?.parts || [])) {
        if (part.inlineData) {
          b64 = part.inlineData.data;
          mimeType = part.inlineData.mimeType || 'image/jpeg';
          break;
        }
      }
      if (!b64) {
        if (attempt === MAX_RETRIES) throw new Error('Gemini returned no image after retries');
        continue;
      }

      const buf = Buffer.from(b64, 'base64');
      const validation = await validateGeneration(buf, tier);
      lastValidation = validation;

      if (!validation.passed) {
        const failed = Object.entries(validation.checks).filter(([, v]) => !v).map(([k]) => k);
        console.log(`[AI Models] Validation failed (attempt ${attempt + 1}): ${failed.join(', ')}`);
        if (attempt === MAX_RETRIES) {
          const { width, height } = validation.metadata;
          return res.status(422).json({
            error: `Generation failed validation after ${MAX_RETRIES + 1} attempts.`,
            failedChecks: failed,
            got: { width, height, size: validation.metadata.size },
            retryCost,
          });
        }
        continue;
      }

      imageBuffer = buf;
      break;
    }

    if (!imageBuffer) throw new Error('Generation failed');

    const uploaded = await uploadBuffer(imageBuffer, {
      folder: 'silkilinen/ai-models',
      detection: 'face_detection',
      resource_type: 'image',
    });

    // Extract face bounding box and compute dHash for identity lock
    const faces = uploaded.faces || [];
    let referenceFaceHash = null;
    let referenceFaceBox = null;

    if (faces.length > 0) {
      const [x, y, w, h] = faces[0];
      referenceFaceBox = { x, y, width: w, height: h };
      referenceFaceHash = await computeFaceHash(imageBuffer, referenceFaceBox);
    }

    const updatePayload = {
      referenceImageUrl: uploaded.secure_url,
      ...(referenceFaceHash ? { referenceFaceHash, referenceFaceBox } : {}),
    };
    await AiModel.findByIdAndUpdate(req.params.id, updatePayload);

    res.json({
      url: uploaded.secure_url,
      cost: tier.estimatedCost,
      retryCost,
      totalCost: tier.estimatedCost + retryCost,
      qualityTier: tierKey,
      resolution: { width: uploaded.width, height: uploaded.height },
      fileSize: uploaded.bytes,
      hasFace: faces.length > 0,
      validationChecks: lastValidation?.checks,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
