const express = require('express');
const router = express.Router();
const { GoogleGenAI } = require('@google/genai');
const AiModel = require('../models/AiModel');
const PhotoshootSession = require('../models/PhotoshootSession');
const Product = require('../models/product');
const { cloudinary } = require('../utils/cloudinary');
const { requireAuth } = require('../middleware/auth');

// ── Config ──────────────────────────────────────────────────────────────────
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-preview-image-generation';
const COST_PER_GENERATION = parseFloat(process.env.GEMINI_COST_PER_GENERATION || '0.13');
const MAX_ITERATIONS_PER_PHOTO = 10;
const MAX_SESSION_GENERATIONS = 30;
const SESSION_COST_WARN = 5;
const SESSION_COST_LIMIT = 10;

// Simple in-memory daily counter (resets on server restart — fine for low-volume admin)
const dailyCounter = {};
function checkDailyLimit() {
  const today = new Date().toISOString().slice(0, 10);
  if (!dailyCounter[today]) dailyCounter[today] = 0;
  const limit = parseInt(process.env.GEMINI_DAILY_LIMIT || '100', 10);
  if (dailyCounter[today] >= limit) {
    throw new Error(`Daily generation limit (${limit}) reached. Try again tomorrow.`);
  }
  dailyCounter[today]++;
}

// ── Prompt building ──────────────────────────────────────────────────────────
const POSITION_PROMPTS = {
  front: 'Full-length front view, model centred, straight-on camera angle, hands relaxed at sides, vertical 3:4 aspect ratio.',
  side: 'Three-quarter side angle, model facing camera with subtle hip shift, one hand softly at hip.',
  detail: 'Closer crop showing garment details — fabric texture, neckline, sleeves, buttons, piping. Focus on craftsmanship.',
  lifestyle: 'Editorial lifestyle setting appropriate to product (bedroom for sleepwear, vanity for accessories), soft natural daylight, magazine quality.',
};

const ALWAYS_APPEND = [
  'Crucially preserve the exact garment from the reference photos: keep colour, texture, cut, buttons, piping, pocket placement, and length identical.',
  'Do not alter the garment design in any way.',
  'Background: clean cream-white studio backdrop, evenly lit, no harsh shadows.',
  'Style: La Perla, Eberjey, Lunya editorial aesthetic.',
  'Barefoot, no shoes, no jewellery. Soft diffused daylight.',
].join(' ');

const FEEDBACK_MAP = {
  'Different pose': 'Same model, same garment, alternative editorial pose',
  'Brighter lighting': 'Increase ambient daylight, lift shadows, more luminous',
  'Closer crop': 'Tighter framing, focus on upper body and garment detail',
  'More elegant expression': 'More refined neutral magazine expression, calm composed',
  'Show garment detail': 'Adjust pose to better display garment cut, drape, and detail',
  'Different background': 'Alternative editorial background while keeping model identical',
};

function buildPrompt(aiModel, position, iterationFeedback) {
  const positionInstructions = POSITION_PROMPTS[position] || POSITION_PROMPTS.front;
  const feedback = iterationFeedback ? (FEEDBACK_MAP[iterationFeedback] || iterationFeedback) : null;
  return [
    aiModel.prompt,
    positionInstructions,
    feedback ? `Improvement request: ${feedback}` : '',
    ALWAYS_APPEND,
  ].filter(Boolean).join('\n\n');
}

// ── Gemini helpers ───────────────────────────────────────────────────────────
function getGenAI() {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

async function imageUrlToBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${url}`);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf).toString('base64');
}

function guessMimeType(url) {
  const lower = (url || '').toLowerCase();
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  return 'image/jpeg';
}

async function runGeneration(aiModel, inputPhotos, position, iterationFeedback) {
  checkDailyLimit();

  const imageParts = [];
  if (aiModel.referenceImageUrl) {
    const base64 = await imageUrlToBase64(aiModel.referenceImageUrl);
    imageParts.push({ inlineData: { mimeType: guessMimeType(aiModel.referenceImageUrl), data: base64 } });
  }
  for (const url of inputPhotos) {
    const base64 = await imageUrlToBase64(url);
    imageParts.push({ inlineData: { mimeType: guessMimeType(url), data: base64 } });
  }

  const prompt = buildPrompt(aiModel, position, iterationFeedback);
  const genai = getGenAI();
  const response = await genai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ parts: [...imageParts, { text: prompt }] }],
    config: { responseModalities: ['IMAGE', 'TEXT'] },
  });

  for (const part of (response.candidates?.[0]?.content?.parts || [])) {
    if (part.inlineData) {
      const uploaded = await cloudinary.uploader.upload(
        `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
        { folder: 'silkilinen/ai-generated' }
      );
      return uploaded.secure_url;
    }
  }
  throw new Error('Gemini returned no image');
}

// ── Auto-model selection ─────────────────────────────────────────────────────
async function pickModel(category) {
  const models = await AiModel.find({ active: true });
  const matched = models.filter(m => m.useCases.includes(category));
  if (matched.length) return matched[0];
  return models.find(m => m.name === 'Aoife') || models[0] || null;
}

// ── Cost helpers ─────────────────────────────────────────────────────────────
function costResponse(session) {
  return {
    totalCost: session.totalCost,
    costWarning: session.totalCost >= SESSION_COST_WARN && session.totalCost < SESSION_COST_LIMIT,
    costBlocked: session.totalCost >= SESSION_COST_LIMIT,
  };
}

// ── Routes ───────────────────────────────────────────────────────────────────

// Create session
router.post('/sessions', requireAuth, async function(req, res) {
  try {
    const { productId, modelId, inputPhotoUrls } = req.body;
    if (!productId || !Array.isArray(inputPhotoUrls) || inputPhotoUrls.length === 0) {
      return res.status(400).json({ error: 'productId and inputPhotoUrls are required' });
    }

    let selectedModel;
    if (modelId) {
      selectedModel = await AiModel.findById(modelId);
      if (!selectedModel) return res.status(404).json({ error: 'AI model not found' });
    } else {
      const product = await Product.findById(productId);
      selectedModel = await pickModel(product?.category || '');
      if (!selectedModel) return res.status(404).json({ error: 'No active AI models found' });
    }

    const session = await PhotoshootSession.create({
      productId,
      selectedModel: selectedModel._id,
      inputPhotos: inputPhotoUrls,
      generatedPhotos: [],
      totalCost: 0,
      iterationCount: 0,
    });

    res.status(201).json({
      sessionId: session._id,
      selectedModel: {
        _id: selectedModel._id,
        name: selectedModel.name,
        heritage: selectedModel.heritage,
        referenceImageUrl: selectedModel.referenceImageUrl,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate one or all positions
router.post('/sessions/:id/generate', requireAuth, async function(req, res) {
  try {
    const { positions, forceOverride } = req.body;
    const session = await PhotoshootSession.findById(req.params.id).populate('selectedModel');
    if (!session) return res.status(404).json({ error: 'Session not found' });

    if (session.totalCost >= SESSION_COST_LIMIT && !forceOverride) {
      return res.status(400).json({
        error: 'SESSION_COST_LIMIT',
        message: `Session spend (€${session.totalCost.toFixed(2)}) has reached the €${SESSION_COST_LIMIT} limit.`,
        ...costResponse(session),
      });
    }
    if (session.iterationCount >= MAX_SESSION_GENERATIONS) {
      return res.status(400).json({ error: `Max session generations (${MAX_SESSION_GENERATIONS}) reached` });
    }

    const aiModel = session.selectedModel;
    if (!aiModel.referenceImageUrl) {
      return res.status(400).json({ error: 'Model has no reference photo. Generate one in AI Models first.' });
    }

    const targetPositions = Array.isArray(positions) && positions.length > 0
      ? positions
      : ['front', 'side', 'detail', 'lifestyle'];

    const results = [];
    for (const position of targetPositions) {
      const url = await runGeneration(aiModel, session.inputPhotos, position, null);
      const photoData = {
        url,
        prompt: buildPrompt(aiModel, position, null),
        position,
        status: 'pending',
        iterationCount: 0,
        generationCost: COST_PER_GENERATION,
      };

      const existingIdx = session.generatedPhotos.findIndex(p => p.position === position);
      if (existingIdx >= 0) {
        session.generatedPhotos[existingIdx] = photoData;
      } else {
        session.generatedPhotos.push(photoData);
      }
      session.totalCost += COST_PER_GENERATION;
      session.iterationCount += 1;
      results.push({ position, url });
    }

    session.markModified('generatedPhotos');
    await session.save();

    res.json({ results, ...costResponse(session) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Iterate on a specific photo with feedback
router.post('/sessions/:id/iterate', requireAuth, async function(req, res) {
  try {
    const { position, feedback, forceOverride } = req.body;
    if (!position || !feedback) {
      return res.status(400).json({ error: 'position and feedback are required' });
    }

    const session = await PhotoshootSession.findById(req.params.id).populate('selectedModel');
    if (!session) return res.status(404).json({ error: 'Session not found' });

    if (session.totalCost >= SESSION_COST_LIMIT && !forceOverride) {
      return res.status(400).json({
        error: 'SESSION_COST_LIMIT',
        message: `Session spend (€${session.totalCost.toFixed(2)}) has reached the €${SESSION_COST_LIMIT} limit.`,
        ...costResponse(session),
      });
    }

    const photoIdx = session.generatedPhotos.findIndex(p => p.position === position);
    if (photoIdx === -1) return res.status(404).json({ error: 'No photo found for that position' });

    const photo = session.generatedPhotos[photoIdx];
    if (photo.iterationCount >= MAX_ITERATIONS_PER_PHOTO) {
      return res.status(400).json({ error: `Max iterations (${MAX_ITERATIONS_PER_PHOTO}) reached for this photo` });
    }

    const url = await runGeneration(session.selectedModel, session.inputPhotos, position, feedback);

    session.generatedPhotos[photoIdx].url = url;
    session.generatedPhotos[photoIdx].feedback = feedback;
    session.generatedPhotos[photoIdx].iterationCount += 1;
    session.generatedPhotos[photoIdx].generationCost += COST_PER_GENERATION;
    session.generatedPhotos[photoIdx].status = 'pending';
    session.totalCost += COST_PER_GENERATION;
    session.iterationCount += 1;
    session.markModified('generatedPhotos');
    await session.save();

    res.json({
      url,
      iterations: session.generatedPhotos[photoIdx].iterationCount,
      ...costResponse(session),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve a photo
router.post('/sessions/:id/approve-photo', requireAuth, async function(req, res) {
  try {
    const { position } = req.body;
    if (!position) return res.status(400).json({ error: 'position is required' });

    const session = await PhotoshootSession.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const photoIdx = session.generatedPhotos.findIndex(p => p.position === position);
    if (photoIdx === -1) return res.status(404).json({ error: 'Photo not found' });

    session.generatedPhotos[photoIdx].status = 'approved';
    session.markModified('generatedPhotos');
    await session.save();

    res.json({ url: session.generatedPhotos[photoIdx].url, position, status: 'approved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Finalize — sets product image to first approved front photo
router.post('/sessions/:id/finalize', requireAuth, async function(req, res) {
  try {
    const session = await PhotoshootSession.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const approved = session.generatedPhotos.filter(p => p.status === 'approved');
    if (approved.length === 0) return res.status(400).json({ error: 'No approved photos to finalize' });

    const primary = approved.find(p => p.position === 'front') || approved[0];
    await Product.findByIdAndUpdate(session.productId, { image: primary.url });

    session.status = 'approved';
    await session.save();

    res.json({ success: true, approvedCount: approved.length, productImageUrl: primary.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get session
router.get('/sessions/:id', requireAuth, async function(req, res) {
  try {
    const session = await PhotoshootSession.findById(req.params.id)
      .populate('selectedModel', 'name heritage referenceImageUrl');
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
