const express = require('express');
const router = express.Router();
const { GoogleGenAI } = require('@google/genai');
const AiModel = require('../models/AiModel');
const PhotoshootSession = require('../models/PhotoshootSession');
const Product = require('../models/Product');
const { cloudinary } = require('../utils/cloudinary');
const { requireAuth } = require('../middleware/auth');
const {
  getTier, getDefaultTierKey, validateGeneration,
  computeFaceHash, hashSimilarity, identityMatchStatus,
} = require('../utils/imageValidation');

// ── Config ──────────────────────────────────────────────────────────────────
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-preview-image-generation';
const MAX_RETRIES = 2;
const MAX_ITERATIONS_PER_PHOTO = 10;
const MAX_SESSION_GENERATIONS = 30;
const SESSION_COST_WARN = 5;
const SESSION_COST_LIMIT = 10;

// Simple in-memory daily counter (resets on server restart)
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

function uploadBuffer(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
    stream.end(buffer);
  });
}

// Call Gemini once — returns { buffer, mimeType, prompt } or throws
async function callGemini(aiModel, inputPhotos, position, iterationFeedback, tier) {
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
    config: {
      responseModalities: ['IMAGE', 'TEXT'],
      imageConfig: { aspectRatio: '4:5', width: tier.width, height: tier.height },
    },
  });

  for (const part of (response.candidates?.[0]?.content?.parts || [])) {
    if (part.inlineData) {
      return {
        buffer: Buffer.from(part.inlineData.data, 'base64'),
        mimeType: part.inlineData.mimeType || 'image/jpeg',
        prompt,
      };
    }
  }
  throw new Error('Gemini returned no image');
}

// Full generation pipeline — NEVER throws on validation failure.
// Returns { url, validationPassed, forReview, ... } always.
// Only throws if every Gemini API call failed (network/auth errors).
async function runGeneration(aiModel, inputPhotos, position, iterationFeedback, tierKey) {
  const tier = getTier(tierKey);
  let retryCount = 0;
  let retryCost = 0;
  let lastGeminiResult = null; // last successful Gemini call (even if validation failed)
  let lastValidation = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      retryCost += tier.estimatedCost;
    }

    let geminiResult;
    try {
      geminiResult = await callGemini(aiModel, inputPhotos, position, iterationFeedback, tier);
      lastGeminiResult = geminiResult;
    } catch (err) {
      console.error(`[AI Photo] Gemini call failed (attempt ${attempt + 1}): ${err.message}`);
      retryCount = attempt;
      if (attempt < MAX_RETRIES) continue;
      // All Gemini API calls failed — use last image if we have one, otherwise throw
      if (lastGeminiResult) break;
      throw err;
    }

    const validation = await validateGeneration(geminiResult.buffer, tier);
    lastValidation = validation;

    if (!validation.passed) {
      const failedChecks = Object.entries(validation.checks)
        .filter(([k, v]) => !v && k !== 'resolution') // resolution is informational only
        .map(([k]) => k);
      console.log(`[AI Photo] Hard validation failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}) for ${position}: ${failedChecks.join(', ')}`);
      retryCount = attempt;
      if (attempt < MAX_RETRIES) continue;
      break; // all retries exhausted — fall through to review upload
    }

    // Validation passed — upload to production folder
    const uploaded = await uploadBuffer(geminiResult.buffer, {
      folder: 'silkilinen/ai-generated',
      detection: 'face_detection',
      resource_type: 'image',
    });

    const faces = uploaded.faces || [];
    const hasFace = faces.length > 0;
    let identSimilarity = null;
    let matchStatus = null;

    if (hasFace && aiModel.referenceFaceHash) {
      const [x, y, w, h] = faces[0];
      const newHash = await computeFaceHash(geminiResult.buffer, { x, y, width: w, height: h });
      if (newHash) {
        identSimilarity = hashSimilarity(aiModel.referenceFaceHash, newHash);
        matchStatus = identityMatchStatus(identSimilarity);
      }
    }

    return {
      url: uploaded.secure_url,
      cloudinaryPublicId: uploaded.public_id,
      prompt: geminiResult.prompt,
      resolution: { width: uploaded.width, height: uploaded.height },
      fileSize: uploaded.bytes,
      validationChecks: validation.checks,
      validationPassed: true,
      forReview: false,
      faceData: faces,
      hasFace,
      identitySimilarity: identSimilarity,
      identityMatchStatus: matchStatus,
      retryCount: attempt,
      retryCost,
    };
  }

  // ── All validation attempts failed — upload last image for admin review ──
  console.warn(`[AI Photo] All ${MAX_RETRIES + 1} attempts failed for ${position} [${tier.label}]. Uploading to review folder.`);

  let reviewUrl = null;
  if (lastGeminiResult) {
    try {
      const uploaded = await uploadBuffer(lastGeminiResult.buffer, {
        folder: 'silkilinen/ai-review',
        resource_type: 'image',
      });
      reviewUrl = uploaded.secure_url;
    } catch (uploadErr) {
      console.error(`[AI Photo] Failed to upload review image: ${uploadErr.message}`);
    }
  }

  return {
    url: reviewUrl,
    prompt: lastGeminiResult?.prompt || null,
    resolution: lastValidation ? { width: lastValidation.metadata.width, height: lastValidation.metadata.height } : null,
    fileSize: lastValidation?.metadata.size ?? null,
    validationChecks: lastValidation?.checks ?? null,
    validationPassed: false,
    forReview: true,
    faceData: [],
    hasFace: false,
    identitySimilarity: null,
    identityMatchStatus: null,
    retryCount,
    retryCost,
  };
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
    costBreakdown: session.costBreakdown,
    costWarning: session.totalCost >= SESSION_COST_WARN && session.totalCost < SESSION_COST_LIMIT,
    costBlocked: session.totalCost >= SESSION_COST_LIMIT,
  };
}

// Apply result to session cost tracking — only charges for successful generations
function applyResultToSession(session, result, tierEstimatedCost) {
  if (result.forReview) {
    // Validation failed — no charge to admin. Track internally only.
    session.failedRetries = (session.failedRetries || 0) + result.retryCount;
    console.log(`[AI Cost] Internal: ~€${(tierEstimatedCost + (result.retryCost || 0)).toFixed(2)} incurred (not charged — validation failed)`);
  } else {
    // Success — charge the single successful generation cost only
    session.totalCost += tierEstimatedCost;
    session.costBreakdown.successful = (session.costBreakdown.successful || 0) + tierEstimatedCost;
    session.costBreakdown.retries = (session.costBreakdown.retries || 0) + (result.retryCost || 0);
    session.failedRetries = (session.failedRetries || 0) + result.retryCount;
  }
}

// ── Routes ───────────────────────────────────────────────────────────────────

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
      failedRetries: 0,
      costBreakdown: { successful: 0, retries: 0 },
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

router.post('/sessions/:id/generate', requireAuth, async function(req, res) {
  try {
    const { positions, forceOverride, tier: reqTier } = req.body;
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

    checkDailyLimit(); // once per user request, not per retry

    const targetPositions = Array.isArray(positions) && positions.length > 0
      ? positions
      : ['front', 'side', 'detail', 'lifestyle'];

    const results = [];
    for (const position of targetPositions) {
      const tierKey = (reqTier && reqTier !== 'auto' && ['standard', 'hd', 'premium'].includes(reqTier))
        ? reqTier
        : getDefaultTierKey(position);
      const tier = getTier(tierKey);

      let result;
      try {
        result = await runGeneration(aiModel, session.inputPhotos, position, null, tierKey);
      } catch (err) {
        // True API failure (not validation) — no charge
        console.error(`[AI Photo] API error for ${position}: ${err.message}`);
        results.push({ position, error: 'Generation failed due to API error. No charge applied.', forReview: false });
        continue;
      }

      applyResultToSession(session, result, tier.estimatedCost);
      session.iterationCount += 1;

      const photoData = {
        url: result.url,
        prompt: result.prompt,
        position,
        status: 'pending',
        iterationCount: 0,
        generationCost: result.forReview ? 0 : tier.estimatedCost,
        qualityTier: tierKey,
        retryCount: result.retryCount,
        retryCost: result.retryCost,
        resolution: result.resolution,
        fileSize: result.fileSize,
        validationChecks: result.validationChecks,
        validationPassed: result.validationPassed,
        forReview: result.forReview,
        faceData: result.faceData,
        hasFace: result.hasFace,
        identitySimilarity: result.identitySimilarity,
        identityMatchStatus: result.identityMatchStatus,
      };

      const existingIdx = session.generatedPhotos.findIndex(p => p.position === position);
      if (existingIdx >= 0) {
        session.generatedPhotos[existingIdx] = photoData;
      } else {
        session.generatedPhotos.push(photoData);
      }

      results.push({
        position,
        url: result.url,
        qualityTier: tierKey,
        retryCount: result.retryCount,
        resolution: result.resolution,
        fileSize: result.fileSize,
        validationChecks: result.validationChecks,
        validationPassed: result.validationPassed,
        forReview: result.forReview,
        hasFace: result.hasFace,
        identitySimilarity: result.identitySimilarity,
        identityMatchStatus: result.identityMatchStatus,
        ...(result.forReview ? {
          reviewMessage: 'Auto-validation failed — no charge applied. You can use this image or regenerate.',
        } : {}),
      });
    }

    session.markModified('generatedPhotos');
    session.markModified('costBreakdown');
    await session.save();

    res.json({ results, ...costResponse(session) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/sessions/:id/iterate', requireAuth, async function(req, res) {
  try {
    const { position, feedback, forceOverride, tier: reqTier } = req.body;
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

    checkDailyLimit();

    const tierKey = (reqTier && reqTier !== 'auto' && ['standard', 'hd', 'premium'].includes(reqTier))
      ? reqTier
      : (photo.qualityTier || getDefaultTierKey(position));
    const tier = getTier(tierKey);

    let result;
    try {
      result = await runGeneration(session.selectedModel, session.inputPhotos, position, feedback, tierKey);
    } catch (err) {
      return res.status(422).json({ error: `Generation failed: ${err.message}. No charge applied.`, ...costResponse(session) });
    }

    applyResultToSession(session, result, tier.estimatedCost);
    session.iterationCount += 1;

    session.generatedPhotos[photoIdx].url = result.url;
    session.generatedPhotos[photoIdx].feedback = feedback;
    session.generatedPhotos[photoIdx].iterationCount += 1;
    session.generatedPhotos[photoIdx].generationCost += result.forReview ? 0 : tier.estimatedCost;
    session.generatedPhotos[photoIdx].status = 'pending';
    session.generatedPhotos[photoIdx].qualityTier = tierKey;
    session.generatedPhotos[photoIdx].retryCount = result.retryCount;
    session.generatedPhotos[photoIdx].retryCost = (photo.retryCost || 0) + result.retryCost;
    session.generatedPhotos[photoIdx].resolution = result.resolution;
    session.generatedPhotos[photoIdx].fileSize = result.fileSize;
    session.generatedPhotos[photoIdx].validationChecks = result.validationChecks;
    session.generatedPhotos[photoIdx].validationPassed = result.validationPassed;
    session.generatedPhotos[photoIdx].forReview = result.forReview;
    session.generatedPhotos[photoIdx].hasFace = result.hasFace;
    session.generatedPhotos[photoIdx].identitySimilarity = result.identitySimilarity;
    session.generatedPhotos[photoIdx].identityMatchStatus = result.identityMatchStatus;

    session.markModified('generatedPhotos');
    session.markModified('costBreakdown');
    await session.save();

    res.json({
      url: result.url,
      iterations: session.generatedPhotos[photoIdx].iterationCount,
      qualityTier: tierKey,
      retryCount: result.retryCount,
      resolution: result.resolution,
      fileSize: result.fileSize,
      validationChecks: result.validationChecks,
      validationPassed: result.validationPassed,
      forReview: result.forReview,
      hasFace: result.hasFace,
      identitySimilarity: result.identitySimilarity,
      identityMatchStatus: result.identityMatchStatus,
      ...(result.forReview ? { reviewMessage: 'Auto-validation failed — no charge applied.' } : {}),
      ...costResponse(session),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/sessions/:id/approve-photo', requireAuth, async function(req, res) {
  try {
    const { position } = req.body;
    if (!position) return res.status(400).json({ error: 'position is required' });

    const session = await PhotoshootSession.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const photoIdx = session.generatedPhotos.findIndex(p => p.position === position);
    if (photoIdx === -1) return res.status(404).json({ error: 'Photo not found' });

    session.generatedPhotos[photoIdx].status = 'approved';
    session.generatedPhotos[photoIdx].forReview = false; // admin has manually approved — no longer in review
    session.markModified('generatedPhotos');
    await session.save();

    res.json({ url: session.generatedPhotos[photoIdx].url, position, status: 'approved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

    res.json({
      success: true,
      approvedCount: approved.length,
      productImageUrl: primary.url,
      totalCost: session.totalCost,
      costBreakdown: session.costBreakdown,
      failedRetries: session.failedRetries,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sessions/:id', requireAuth, async function(req, res) {
  try {
    const session = await PhotoshootSession.findById(req.params.id)
      .populate('selectedModel', 'name heritage referenceImageUrl referenceFaceHash');
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
