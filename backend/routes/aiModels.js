const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const AiModel = require('../models/AiModel');
const { cloudinary } = require('../utils/cloudinary');
const { requireAuth } = require('../middleware/auth');
const fashnImage = require('../services/fashnImage');

// Shared AI rate limiter — 20/hr per IP. Same shape as adminProducts.js.
const aiRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI generation calls in the last hour. Wait a few minutes and try again.' },
});

// Field allowlist for direct create/update — anything else in req.body
// is dropped before it hits Mongoose. Stops a tampered request from
// flipping server-controlled flags like `locked` from outside the
// official "lock model" flow.
// Fields an admin may set on an AI model via create/update. Anything not on
// this list is silently dropped by pickAiModelFields() before the DB write —
// keep this in sync with both the AiModel schema and the admin form so
// fields the operator fills in actually persist.
const AI_MODEL_ALLOWED_FIELDS = [
  'name', 'heritage', 'description', 'prompt',
  'productShotPromptTemplate', 'lifestyleShotPromptTemplate',
  'referenceImageUrl', 'useCases', 'markets',
  'active', 'locked',
];

function pickAiModelFields(body) {
  const out = {};
  for (const k of AI_MODEL_ALLOWED_FIELDS) {
    if (k in body) out[k] = body[k];
  }
  return out;
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms / 1000}s: ${label}`)), ms);
    promise.then(
      v => { clearTimeout(timer); resolve(v); },
      e => { clearTimeout(timer); reject(e); }
    );
  });
}

router.get('/', requireAuth, async function(req, res) {
  try {
    const models = await AiModel.find().sort({ createdAt: 1 });
    res.json(models);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireAuth, async function(req, res) {
  try {
    const model = await AiModel.create(pickAiModelFields(req.body));
    res.status(201).json(model);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', requireAuth, async function(req, res) {
  try {
    const model = await AiModel.findByIdAndUpdate(req.params.id, pickAiModelFields(req.body), { new: true, runValidators: true });
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
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/generate-reference', requireAuth, aiRateLimit, async function(req, res) {
  try {
    const aiModel = await AiModel.findById(req.params.id);
    if (!aiModel) return res.status(404).json({ error: 'Model not found' });
    if (aiModel.locked) return res.status(400).json({ error: 'Model is locked. Unlock before regenerating.' });

    // Build a model-create prompt from the model's locked character descriptor
    // plus consistent studio framing. FASHN model-create returns a photoreal
    // full-length model that the try-on then dresses.
    const prompt = [
      aiModel.prompt,
      'Full-length fashion model standing centred on a clean cream-white studio backdrop, soft even diffused daylight from the left, barefoot, no jewellery.',
      'La Perla / Eberjey / Lunya editorial aesthetic. Professional luxury fashion photography, sharp focus, photorealistic.',
    ].filter(Boolean).join('\n\n');

    console.log(`[AI Models] FASHN model-create for "${aiModel.name}"…`);
    const out = await fashnImage.generateModel({ prompt });

    const uploaded = await withTimeout(
      cloudinary.uploader.upload(out.imageUrl, { folder: 'silkilinen/ai-models', resource_type: 'image' }),
      30_000,
      'Cloudinary upload (model-create)'
    );

    await AiModel.findByIdAndUpdate(req.params.id, { referenceImageUrl: uploaded.secure_url });

    res.json({
      url: uploaded.secure_url,
      provider: out.provider,
      resolution: { width: uploaded.width, height: uploaded.height },
    });
  } catch (err) {
    console.error('[AI Models] generate-reference error:', err.message);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

module.exports = router;
