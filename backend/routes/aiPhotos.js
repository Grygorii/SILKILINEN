const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { GoogleGenAI } = require('@google/genai');
const AiModel = require('../models/AiModel');
const PhotoshootSession = require('../models/PhotoshootSession');
const Product = require('../models/Product');
const { cloudinary } = require('../utils/cloudinary');
const { requireAuth } = require('../middleware/auth');
const { getTier, getDefaultTierKey } = require('../utils/imageValidation');
const SystemState = require('../models/SystemState');
const falImage = require('../services/falImage');
const { shouldUseFal } = require('../services/aiImageRouter');

// Shared AI rate limiter — 20/hr per IP. Same shape as adminProducts.js.
// aiPhotos already has a per-day Gemini quota counter at the DB level,
// but that's not an HTTP rate limit — bursts within a minute weren't
// constrained.
const aiRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI generation calls in the last hour. Wait a few minutes and try again.' },
});

// ── Config ──────────────────────────────────────────────────────────────────
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-preview-image-generation';
const MAX_ITERATIONS_PER_PHOTO = 10;
const MAX_SESSION_GENERATIONS = 30;
const SESSION_COST_WARN = 5;
const SESSION_COST_LIMIT = 10;

// Persistent daily counter — survives server restarts and deploys
async function checkAndIncrementDailyLimit() {
  const today = new Date().toISOString().slice(0, 10);
  const key = `ai_daily_${today}`;
  const limit = parseInt(process.env.GEMINI_DAILY_LIMIT || '100', 10);

  const state = await SystemState.findOneAndUpdate(
    { key },
    { $inc: { value: 1 } },
    { upsert: true, new: true }
  );

  if (state.value > limit) {
    // Undo the increment — we're over limit
    await SystemState.findOneAndUpdate({ key }, { $inc: { value: -1 } });
    throw new Error(`Daily generation limit (${limit}) reached. Try again tomorrow.`);
  }
}

// ── Workflow presets ──────────────────────────────────────────────────────────
const WORKFLOW_PRESETS = {
  quick_add: [
    { position: 'thumbnail', tier: 'standard', label: 'Shop card' },
  ],
  standard: [
    { position: 'thumbnail', tier: 'standard', label: 'Shop card' },
    { position: 'back',      tier: 'hd',       label: 'Back view' },
    { position: 'detail',    tier: 'hd',       label: 'Detail close-up' },
  ],
  full_launch: [
    { position: 'thumbnail', tier: 'standard', label: 'Shop card' },
    { position: 'front',     tier: 'premium',  label: 'Product page hero' },
    { position: 'back',      tier: 'hd',       label: 'Back view' },
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
// ── Per-position prompts ──────────────────────────────────────────────────────
// Each position is a flowing Gemini-native description of the shot, not a
// keyword list. The garment is always coming from the reference image
// alongside this text — the position prompt only directs the camera, pose,
// crop, and framing. The garment-preservation language and the silk-specific
// lighting live in ALWAYS_APPEND so they're applied identically to every
// frame in the set.
const POSITION_PROMPTS = {
  thumbnail:
    'A tight editorial crop of the model from the waist to the crown, centred and relaxed. ' +
    'The garment is clearly visible from the shoulders to the hips with natural drape. ' +
    'Same lighting and backdrop as the full-length frames in the set so the shop-grid card reads ' +
    'as part of one consistent series. Face mostly cropped above the brow — product-led, not portrait-led.',

  front:
    'A full-length front view of the model standing relaxed and centred, barefoot, arms loose at her sides. ' +
    'Photograph her from just above the brow down to the floor so the face is mostly out of frame and the garment leads. ' +
    'Vertical 4:5 portrait. The silk falls in natural soft vertical folds.',

  side:
    'A three-quarter side angle of the model, body turned roughly thirty degrees from camera, ' +
    'one hand softly at the hip, the other relaxed at the side. Full-length framing matching the front view crop. ' +
    'The drape on the side profile should reveal the cut and the satin sheen along the body.',

  back:
    'A full-length back view of the model centred, arms loose, hair tucked aside so the neckline and back construction read clearly. ' +
    'The fabric falls in natural soft vertical folds. Same lighting, backdrop, and crop as the front view in the set.',

  detail:
    'A tight macro close-up on the garment itself — a cuff, the self-tie belt knot, the collar piping, ' +
    'or a section of fabric where the weave catches the light. Shallow depth of field, sharp focus on the textile. ' +
    'The frame must convince the viewer this is real 19-momme mulberry silk: visible weave, soft satin sheen along the fold, ' +
    'natural drape, never plasticky, never flat matte. The garment can be hand-held or worn close to camera; the face is not necessarily in frame.',

  lifestyle:
    'An intimate, lived-in interior — a deep velvet sofa, a linen-dressed bed, or a softly lit bedroom corner — ' +
    'the model relaxed and unposed wearing the garment. Low warm directional window light from one side, ' +
    'soft and golden, gentle shadows, film-like atmosphere. The silk catches the light softly and shows natural creasing as it is worn. ' +
    'Mood takes priority over exact colour fidelity — this frame is for atmosphere and never used as the HERO or FRONT reference.',
};

// ── Universal appendix ────────────────────────────────────────────────────────
// Applied to every generation in every position. The four blocks below are
// non-negotiable: garment preservation, silk lighting, backdrop adapted to
// the colourway, and the editorial-restraint register.
const ALWAYS_APPEND = [
  // 1 — garment preservation (the most important block; phrased as positive
  //     instructions because Gemini ignores AVOID/negative-prompt syntax)
  'CRITICAL — preserve the garment exactly. The garment shown in the reference photo is the actual product being sold. ' +
  'Reproduce it identically: the same colour, the same fabric, the same cut and length, the same trim, the same belt and tie, ' +
  'the same neckline and sleeves, the same piping, the same pocket placement. ' +
  'Do not restyle, recolour, or redesign the garment in any way. ' +
  'If the reference shows a sky-blue silk robe with a cream contrast collar, the output must show a sky-blue silk robe with a cream contrast collar — never any other colour.',

  // 2 — silk-specific lighting (the thing OvH-style flat high-key kills)
  'LIGHTING — directional for silk. A single large soft key light from camera-left at roughly forty-five degrees, ' +
  'with gentle fill from the right. The light rakes across the silk so a soft specular sheen runs along the folds and ' +
  'the satin reads fluid and liquid. The fabric is soft mulberry silk, never plasticky-glossy, never flat matte. ' +
  'Avoid harsh shadows and blown highlights.',

  // 3 — face-cropping (lifted from OvH's grid pattern and from the practical
  //     limit that AI image gen is least reliable at faces). Applies to every
  //     product position; LIFESTYLE relaxes this in its own POSITION_PROMPTS
  //     entry by describing the gaze explicitly.
  'FACE FRAMING — product-led. For HERO / FRONT / BACK / SIDE / DETAIL frames, ' +
  'the model is photographed from just above the brow downward — face mostly out of frame, no portrait. ' +
  'The garment is the subject; the model is its quiet setting. Even if the model identity description ' +
  'emphasises the face, in product shots the face is cropped. This rule does not apply to the LIFESTYLE frame.',

  // Note: the BACKDROP block is computed per-product upstream via
  // backdropForGarment() and inserted by buildPrompt(); we don't include a
  // generic backdrop line here to avoid contradicting it.

  // 4 — overall register
  'STYLE — editorial restraint. True-to-life colour, sharp focus, barefoot, no shoes, no jewellery. ' +
  'The register is Toast UK, &Daughter, Lunya, Eberjey — quiet, considered, never commercial-glossy. ' +
  'Hands and feet rendered with correct anatomy.',
].join('\n\n');

const FEEDBACK_MAP = {
  'Different pose':
    'Same model and the exact same garment from the reference (no colour or trim change). Adjust body angle, ' +
    'hand position, or gaze for an alternative editorial pose. Lighting and backdrop unchanged.',
  'Brighter lighting':
    'Lift the overall exposure roughly half a stop. Soften the shadows on the garment side and make the daylight ' +
    'feel more luminous, while keeping the directional key light from camera-left so the silk sheen still reads.',
  'Closer crop':
    'Tighter framing focused on the upper body and garment detail — shoulders to mid-thigh. Same backdrop, same lighting.',
  'More elegant expression':
    'More refined neutral magazine expression — calm, composed, brow relaxed, gaze direct but unforced. No smile, no performance.',
  'Show garment detail':
    'Adjust the pose so the garment cut, drape, and trim read more clearly — open the front slightly, lift one sleeve, ' +
    'or move the belt knot into frame.',
  'Different background':
    'Alternative editorial backdrop in the same family (warm sand ↔ deep taupe ↔ soft cream). Model and garment identical.',
};

// ── Backdrop selection from product colour ────────────────────────────────────
// A pale silk on a pale backdrop dissolves into the ground (see OvH's Queenie
// Swan + Lila Blanca in their grid). A saturated silk on a too-bright backdrop
// loses its colour bias. Compute the relative luminance of the product's
// colorHex and pick a backdrop that creates contrast in the right direction.

function relativeLuminance(hex) {
  const h = String(hex || '').replace(/^#/, '');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  const channel = i => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

function backdropForGarment(product) {
  const colourName = product?.colorName || product?.colours?.[0] || 'the garment';
  const lum = relativeLuminance(product?.colorHex);
  if (lum === null) {
    return `BACKDROP — adaptive: choose a seamless studio ground that contrasts with the garment. ` +
      `If the silk reads pale or cream, use a deeper greige/taupe backdrop. ` +
      `If the silk reads saturated or dark, use a warm sand backdrop. Soft natural shadow at the feet.`;
  }
  if (lum > 0.7) {
    return `BACKDROP — pale-aware: the garment is a pale colourway (${colourName}). ` +
      `Use a seamless deep greige/taupe backdrop (warm grey-brown, mid-tone, around #8C7C6E). ` +
      `The backdrop must be visibly deeper than the silk so the garment never dissolves into the ground. ` +
      `Soft natural shadow at the feet.`;
  }
  if (lum < 0.15) {
    return `BACKDROP — dark-aware: the garment is a very dark colourway (${colourName}). ` +
      `Use a seamless warm-cream backdrop (around #F2E8D6) so the garment silhouette reads cleanly ` +
      `and the silk sheen is visible against the lighter ground. Soft natural shadow at the feet.`;
  }
  return `BACKDROP — saturated-aware: the garment is a saturated mid-tone colourway (${colourName}). ` +
    `Use a seamless warm sand backdrop (around #D9C9AE) so the silk colour stays the focal point ` +
    `and the warm ground complements without competing. Soft natural shadow at the feet.`;
}

function buildPrompt(aiModel, position, iterationFeedback, product) {
  const feedback = iterationFeedback ? (FEEDBACK_MAP[iterationFeedback] || iterationFeedback) : null;
  // The product-aware backdrop overrides the generic backdrop line in
  // ALWAYS_APPEND for whichever shot this is, so the generator picks the
  // right contrast direction for the specific colourway.
  const backdrop = product ? backdropForGarment(product) : null;
  return [
    aiModel.prompt,
    POSITION_PROMPTS[position] || POSITION_PROMPTS.front,
    backdrop,
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
  return `${product.name}${colourPart}, ${desc} — handmade silk by SILKILINEN, Donegal`;
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

  const prompt = buildPrompt(aiModel, position, iterationFeedback, opts.product);
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
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/sessions/:id/generate', requireAuth, aiRateLimit, async function(req, res) {
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
    const product = await Product.findById(session.productId, 'name slug colours category colorName colorHex').lean();
    const productSlug = toSlug(product?.slug || product?.name || String(session.productId));
    const modelSlug = toSlug(aiModel.name);

    await checkAndIncrementDailyLimit();

    const results = [];
    for (const job of jobs) {
      const { position, tier: tierKey, label } = job;
      const tier = getTier(tierKey);
      const publicId = `${productSlug}-${modelSlug}-${position}`;
      const altText = product ? generateAltText(product, position) : null;

      let result;
      try {
        if (shouldUseFal(product?.category)) {
          console.log(`[aiImageRouter] Category '${product?.category}' → fal.ai (Flux Kontext multi)`);
          const productImageUrl = session.inputPhotos?.[0];
          if (!productImageUrl) {
            results.push({ position, label, tier: tierKey, error: 'No input photo on session', errorType: 'no_product_image', userMessage: 'Cannot generate AI photo via fal.ai: session has no uploaded input photo. Upload a product reference photo first.' });
            continue;
          }
          const prompt = buildPrompt(aiModel, position, null, product);
          const falResult = await falImage.generateImage({ modelImageUrl: aiModel.referenceImageUrl, productImageUrl, prompt });
          const cloudinaryOpts = {
            folder: 'silkilinen/ai-generated',
            resource_type: 'image',
            ...(publicId ? { public_id: publicId, overwrite: true, use_filename: false } : {}),
            ...(altText ? { context: { alt: altText, caption: altText } } : {}),
          };
          const uploaded = await withTimeout(
            cloudinary.uploader.upload(falResult.imageUrl, cloudinaryOpts),
            30_000, 'Cloudinary upload (fal)'
          );
          result = { url: uploaded.secure_url, prompt, resolution: { width: uploaded.width, height: uploaded.height } };
        } else {
          console.log(`[aiImageRouter] Category '${product?.category}' → Gemini`);
          result = await generate(aiModel, session.inputPhotos, position, null, tierKey, { publicId, altText, product });
        }
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
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
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

    await checkAndIncrementDailyLimit();

    const tierKey = (reqTier && ['standard', 'hd', 'premium'].includes(reqTier))
      ? reqTier
      : (photo.qualityTier || getDefaultTierKey(position));
    const tier = getTier(tierKey);

    // Rebuild SEO opts for the overwrite case
    const product = await Product.findById(session.productId, 'name slug colours category colorName colorHex').lean();
    const productSlug = toSlug(product?.slug || product?.name || String(session.productId));
    const modelSlug = toSlug(session.selectedModel.name);
    const publicId = `${productSlug}-${modelSlug}-${position}`;
    const altText = product ? generateAltText(product, position) : null;

    let result;
    try {
      if (shouldUseFal(product?.category)) {
        console.log(`[aiImageRouter] Category '${product?.category}' → fal.ai (Flux Kontext multi) [iterate]`);
        const productImageUrl = session.inputPhotos?.[0];
        if (!productImageUrl) {
          return res.status(400).json({ error: 'Cannot generate AI photo via fal.ai: session has no uploaded input photo. Upload a product reference photo first.', errorType: 'no_product_image', ...costResponse(session) });
        }
        const prompt = buildPrompt(session.selectedModel, position, feedback || null, product);
        const falResult = await falImage.generateImage({ modelImageUrl: session.selectedModel.referenceImageUrl, productImageUrl, prompt });
        const cloudinaryOpts = {
          folder: 'silkilinen/ai-generated',
          resource_type: 'image',
          ...(publicId ? { public_id: publicId, overwrite: true, use_filename: false } : {}),
          ...(altText ? { context: { alt: altText, caption: altText } } : {}),
        };
        const uploaded = await withTimeout(
          cloudinary.uploader.upload(falResult.imageUrl, cloudinaryOpts),
          30_000, 'Cloudinary upload (fal)'
        );
        result = { url: uploaded.secure_url, prompt, resolution: { width: uploaded.width, height: uploaded.height } };
      } else {
        console.log(`[aiImageRouter] Category '${product?.category}' → Gemini [iterate]`);
        result = await generate(session.selectedModel, session.inputPhotos, position, feedback || null, tierKey, { publicId, altText, product });
      }
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
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
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
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
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
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/sessions/:id', requireAuth, async function(req, res) {
  try {
    const session = await PhotoshootSession.findById(req.params.id)
      .populate('selectedModel', 'name heritage referenceImageUrl');
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
