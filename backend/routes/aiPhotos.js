const express = require('express');
const router = express.Router();
const { GoogleGenAI } = require('@google/genai');
const AiModel = require('../models/AiModel');
const PhotoshootSession = require('../models/PhotoshootSession');
const Product = require('../models/Product');
const { cloudinary } = require('../utils/cloudinary');
const { requireAuth } = require('../middleware/auth');
const { getTier, getDefaultTierKey } = require('../utils/imageValidation');

// ── Config ──────────────────────────────────────────────────────────────────
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-preview-image-generation';
const MAX_ITERATIONS_PER_PHOTO = 10;
const MAX_SESSION_GENERATIONS = 30;
const SESSION_COST_WARN = 5;
const SESSION_COST_LIMIT = 10;

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

// ── Workflow presets ──────────────────────────────────────────────────────────
const WORKFLOW_PRESETS = {
  quick_add: [
    { position: 'thumbnail', tier: 'standard', label: 'Shop card' },
  ],
  standard: [
    { position: 'thumbnail', tier: 'standard', label: 'Shop card' },
    { position: 'front',     tier: 'hd',       label: 'Product page hero' },
    { position: 'detail',    tier: 'hd',       label: 'Detail close-up' },
  ],
  full_launch: [
    { position: 'thumbnail', tier: 'standard', label: 'Shop card' },
    { position: 'front',     tier: 'premium',  label: 'Product page hero' },
    { position: 'side',      tier: 'hd',       label: 'Side angle' },
    { position: 'detail',    tier: 'hd',       label: 'Detail close-up' },
  ],
};

const POSITION_LABELS = {
  thumbnail: 'Shop card',
  front:     'Product page hero',
  side:      'Side angle',
  detail:    'Detail close-up',
  lifestyle: 'Lifestyle',
};

// ── Prompts ──────────────────────────────────────────────────────────────────
const POSITION_PROMPTS = {
  thumbnail: 'Tight editorial crop from waist to crown, model centred. Garment clearly visible from shoulders to hips. Clean cream-white studio backdrop. Tighter framing than a full-length portrait — optimised for shop grid display.',
  front:     'Full-length front view, model centred, straight-on camera angle, hands relaxed at sides, vertical 3:4 aspect ratio.',
  side:      'Three-quarter side angle, model facing camera with subtle hip shift, one hand softly at hip.',
  detail:    'Closer crop showing garment details — fabric texture, neckline, sleeves, buttons, piping. Focus on craftsmanship.',
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
  'Different pose':           'Same model, same garment, alternative editorial pose',
  'Brighter lighting':        'Increase ambient daylight, lift shadows, more luminous',
  'Closer crop':              'Tighter framing, focus on upper body and garment detail',
  'More elegant expression':  'More refined neutral magazine expression, calm composed',
  'Show garment detail':      'Adjust pose to better display garment cut, drape, and detail',
  'Different background':     'Alternative editorial background while keeping model identical',
};

function buildPrompt(aiModel, position, iterationFeedback) {
  const feedback = iterationFeedback ? (FEEDBACK_MAP[iterationFeedback] || iterationFeedback) : null;
  return [
    aiModel.prompt,
    POSITION_PROMPTS[position] || POSITION_PROMPTS.front,
    feedback ? `Improvement request: ${feedback}` : '',
    ALWAYS_APPEND,
  ].filter(Boolean).join('\n\n');
}

// ── Alt text ──────────────────────────────────────────────────────────────────
const POSITION_ALT_DESCRIPTIONS = {
  thumbnail: 'shop image',
  front:     'front view modelled',
  side:      'side angle modelled',
  detail:    'fabric and craftsmanship close-up',
  lifestyle: 'styled in lifestyle setting',
};

function generateAltText(product, position) {
  const colour = product.colours?.[0] || '';
  const colourPart = colour ? ` in ${colour}` : '';
  const desc = POSITION_ALT_DESCRIPTIONS[position] || position;
  return `${product.name}${colourPart}, ${desc} — handmade silk by SILKILINEN, Dublin`;
}

// ── Cloudinary / Gemini helpers ───────────────────────────────────────────────
function getGenAI() {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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

async function imageUrlToBase64(url) {
  const res = await withTimeout(fetch(url), 20_000, `fetch image ${url}`);
  if (!res.ok) throw new Error(`Image fetch failed (${res.status}): ${url}`);
  return Buffer.from(await res.arrayBuffer()).toString('base64');
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

function toSlug(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Call Gemini and upload to Cloudinary.
// opts: { publicId?, altText? }
async function generate(aiModel, inputPhotos, position, iterationFeedback, tierKey, opts = {}) {
  const tier = getTier(tierKey);
  const tag = `[AI:${position}:${tierKey}]`;

  console.log(`${tag} START — model="${aiModel.name}" inputs=${inputPhotos.length}`);

  const imageParts = [];
  if (aiModel.referenceImageUrl) {
    console.log(`${tag} Fetching reference image…`);
    const data = await imageUrlToBase64(aiModel.referenceImageUrl);
    console.log(`${tag} Reference OK (${Math.round(data.length * 0.75 / 1024)}KB)`);
    imageParts.push({ inlineData: { mimeType: guessMimeType(aiModel.referenceImageUrl), data } });
  }
  for (let i = 0; i < inputPhotos.length; i++) {
    console.log(`${tag} Fetching input ${i + 1}/${inputPhotos.length}…`);
    const data = await imageUrlToBase64(inputPhotos[i]);
    console.log(`${tag} Input ${i + 1} OK (${Math.round(data.length * 0.75 / 1024)}KB)`);
    imageParts.push({ inlineData: { mimeType: guessMimeType(inputPhotos[i]), data } });
  }

  const prompt = buildPrompt(aiModel, position, iterationFeedback);
  const genai = getGenAI();
  console.log(`${tag} Calling Gemini (${GEMINI_MODEL}) with ${imageParts.length} image(s)…`);
  const t0 = Date.now();

  const response = await withTimeout(
    genai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ parts: [...imageParts, { text: prompt }] }],
      config: {
        responseModalities: ['IMAGE', 'TEXT'],
        imageConfig: { aspectRatio: '4:5', width: tier.width, height: tier.height },
      },
    }),
    90_000,
    'Gemini generateContent'
  );

  console.log(`${tag} Gemini responded in ${Date.now() - t0}ms`);

  let imageBuffer = null;
  for (const part of (response.candidates?.[0]?.content?.parts || [])) {
    if (part.inlineData) {
      imageBuffer = Buffer.from(part.inlineData.data, 'base64');
      break;
    }
  }
  if (!imageBuffer) throw new Error('Gemini returned no image');

  console.log(`${tag} Buffer: ${Math.round(imageBuffer.length / 1024)}KB — uploading…`);

  const cloudinaryOpts = {
    folder: 'silkilinen/ai-generated',
    resource_type: 'image',
  };
  if (opts.publicId) {
    cloudinaryOpts.public_id = opts.publicId;
    cloudinaryOpts.overwrite = true;
    cloudinaryOpts.use_filename = false;
  }
  if (opts.altText) {
    cloudinaryOpts.context = { alt: opts.altText, caption: opts.altText };
  }

  const uploaded = await withTimeout(
    uploadBuffer(imageBuffer, cloudinaryOpts),
    30_000,
    'Cloudinary upload'
  );

  console.log(`${tag} DONE — ${uploaded.secure_url} (${uploaded.width}×${uploaded.height})`);

  return {
    url: uploaded.secure_url,
    prompt,
    resolution: { width: uploaded.width, height: uploaded.height },
  };
}

// ── Auto-model selection ──────────────────────────────────────────────────────
async function pickModel(category) {
  const models = await AiModel.find({ active: true });
  const matched = models.filter(m => m.useCases.includes(category));
  if (matched.length) return matched[0];
  return models.find(m => m.name === 'Aoife') || models[0] || null;
}

// ── Error classification ──────────────────────────────────────────────────────
function classifyError(err) {
  const msg = (err?.message || '').toLowerCase();
  if (msg.includes('timed out after 90s') || msg.includes('gemini generatecontent')) {
    return { errorType: 'timeout', userMessage: 'Generation timed out — no charge applied.' };
  }
  if (msg.includes('timed out after')) {
    return { errorType: 'timeout', userMessage: 'Request timed out — no charge applied.' };
  }
  if (msg.includes('503') || msg.includes('unavailable') || msg.includes('overloaded')) {
    return { errorType: 'service_unavailable', userMessage: 'Gemini is temporarily busy — no charge applied.' };
  }
  if (msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('quota')) {
    return { errorType: 'rate_limit', userMessage: 'Too many requests — wait a minute and try again. No charge applied.' };
  }
  if (msg.includes('gemini returned no image')) {
    return { errorType: 'no_image', userMessage: 'Gemini returned no image — no charge applied.' };
  }
  if (msg.includes('daily generation limit')) {
    return { errorType: 'daily_limit', userMessage: err.message };
  }
  return { errorType: 'unknown', userMessage: 'Generation failed — no charge applied.' };
}

// ── Cost helpers ──────────────────────────────────────────────────────────────
function costResponse(session) {
  return {
    totalCost: session.totalCost,
    costWarning: session.totalCost >= SESSION_COST_WARN && session.totalCost < SESSION_COST_LIMIT,
    costBlocked: session.totalCost >= SESSION_COST_LIMIT,
  };
}

// ── Routes ────────────────────────────────────────────────────────────────────

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

router.post('/sessions/:id/generate', requireAuth, async function(req, res) {
  try {
    const { preset, positions, forceOverride } = req.body;
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

    // Resolve job list from preset, custom positions array, or default
    let jobs;
    if (preset && WORKFLOW_PRESETS[preset]) {
      jobs = WORKFLOW_PRESETS[preset];
    } else if (Array.isArray(positions) && positions.length > 0) {
      if (typeof positions[0] === 'string') {
        // Legacy: array of position strings
        jobs = positions.map(p => ({
          position: p,
          tier: getDefaultTierKey(p),
          label: POSITION_LABELS[p] || p,
        }));
      } else {
        // New: [{position, tier, label}]
        jobs = positions;
      }
    } else {
      jobs = WORKFLOW_PRESETS.standard;
    }

    // Fetch product once for SEO data
    const product = await Product.findById(session.productId, 'name slug colours').lean();
    const productSlug = toSlug(product?.slug || product?.name || String(session.productId));
    const modelSlug = toSlug(aiModel.name);

    checkDailyLimit();

    const results = [];
    for (const job of jobs) {
      const { position, tier: tierKey, label } = job;
      const tier = getTier(tierKey);
      const publicId = `${productSlug}-${modelSlug}-${position}`;
      const altText = product ? generateAltText(product, position) : null;

      let result;
      try {
        result = await generate(aiModel, session.inputPhotos, position, null, tierKey, { publicId, altText });
      } catch (err) {
        console.error(`[AI Photo] Generation failed for ${position}: ${err.message}`);
        const { errorType, userMessage } = classifyError(err);
        results.push({ position, label, tier: tierKey, error: err.message, errorType, userMessage });
        continue;
      }

      session.totalCost += tier.estimatedCost;
      session.iterationCount += 1;

      const photoData = {
        url: result.url,
        prompt: result.prompt,
        position,
        label,
        altText: altText || '',
        status: 'pending',
        iterationCount: 0,
        generationCost: tier.estimatedCost,
        qualityTier: tierKey,
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
        label,
        tier: tierKey,
        resolution: result.resolution,
      });
    }

    session.markModified('generatedPhotos');
    await session.save();

    res.json({ results, ...costResponse(session) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/sessions/:id/iterate', requireAuth, async function(req, res) {
  try {
    const { position, feedback, forceOverride, tier: reqTier } = req.body;
    if (!position) return res.status(400).json({ error: 'position is required' });

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

    const tierKey = (reqTier && ['standard', 'hd', 'premium'].includes(reqTier))
      ? reqTier
      : (photo.qualityTier || getDefaultTierKey(position));
    const tier = getTier(tierKey);

    // Rebuild SEO opts for the overwrite case
    const product = await Product.findById(session.productId, 'name slug colours').lean();
    const productSlug = toSlug(product?.slug || product?.name || String(session.productId));
    const modelSlug = toSlug(session.selectedModel.name);
    const publicId = `${productSlug}-${modelSlug}-${position}`;
    const altText = product ? generateAltText(product, position) : null;

    let result;
    try {
      result = await generate(session.selectedModel, session.inputPhotos, position, feedback || null, tierKey, { publicId, altText });
    } catch (err) {
      const { errorType, userMessage } = classifyError(err);
      return res.status(422).json({ error: `Generation failed: ${err.message}`, errorType, userMessage, ...costResponse(session) });
    }

    session.totalCost += tier.estimatedCost;
    session.iterationCount += 1;

    session.generatedPhotos[photoIdx].url = result.url;
    session.generatedPhotos[photoIdx].feedback = feedback || null;
    session.generatedPhotos[photoIdx].iterationCount += 1;
    session.generatedPhotos[photoIdx].generationCost += tier.estimatedCost;
    session.generatedPhotos[photoIdx].status = 'pending';
    session.generatedPhotos[photoIdx].qualityTier = tierKey;

    session.markModified('generatedPhotos');
    await session.save();

    res.json({
      url: result.url,
      iterations: session.generatedPhotos[photoIdx].iterationCount,
      tier: tierKey,
      resolution: result.resolution,
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

    const primary = approved.find(p => p.position === 'front') || approved.find(p => p.position === 'thumbnail') || approved[0];
    await Product.findByIdAndUpdate(session.productId, { image: primary.url });

    session.status = 'approved';
    await session.save();

    res.json({
      success: true,
      approvedCount: approved.length,
      productImageUrl: primary.url,
      totalCost: session.totalCost,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
