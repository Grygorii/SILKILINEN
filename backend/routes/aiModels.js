const express = require('express');
const router = express.Router();
const { GoogleGenAI } = require('@google/genai');
const AiModel = require('../models/AiModel');
const { cloudinary } = require('../utils/cloudinary');
const { requireAuth } = require('../middleware/auth');
const { getTier } = require('../utils/imageValidation');

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-preview-image-generation';

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

router.post('/:id/generate-reference', requireAuth, async function(req, res) {
  try {
    const aiModel = await AiModel.findById(req.params.id);
    if (!aiModel) return res.status(404).json({ error: 'Model not found' });
    if (aiModel.locked) return res.status(400).json({ error: 'Model is locked. Unlock before regenerating.' });
    if (!process.env.GEMINI_API_KEY) return res.status(400).json({ error: 'GEMINI_API_KEY is not configured' });

    const tierKey = req.body.tier && ['standard', 'hd', 'premium'].includes(req.body.tier)
      ? req.body.tier
      : 'premium';
    const tier = getTier(tierKey);

    const prompt = [
      aiModel.prompt,
      'Full-length portrait, model centred on a clean cream-white studio backdrop. Soft, even diffused daylight from the left.',
      'Style: La Perla, Eberjey, Lunya editorial aesthetic. No jewellery, no shoes. Barefoot.',
      'Professional luxury fashion photography. Sharp focus, no motion blur.',
    ].join('\n\n');

    const genai = getGenAI();
    const response = await genai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: ['IMAGE', 'TEXT'],
        imageConfig: { aspectRatio: '4:5', width: tier.width, height: tier.height },
      },
    });

    let imageBuffer = null;
    let mimeType = 'image/jpeg';
    for (const part of (response.candidates?.[0]?.content?.parts || [])) {
      if (part.inlineData) {
        imageBuffer = Buffer.from(part.inlineData.data, 'base64');
        mimeType = part.inlineData.mimeType || 'image/jpeg';
        break;
      }
    }
    if (!imageBuffer) throw new Error('Gemini returned no image');

    const uploaded = await uploadBuffer(imageBuffer, {
      folder: 'silkilinen/ai-models',
      resource_type: 'image',
    });

    await AiModel.findByIdAndUpdate(req.params.id, { referenceImageUrl: uploaded.secure_url });

    res.json({
      url: uploaded.secure_url,
      cost: tier.estimatedCost,
      qualityTier: tierKey,
      resolution: { width: uploaded.width, height: uploaded.height },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
