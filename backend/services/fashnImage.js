// FASHN.ai provider — virtual try-on (product photoshoots) + model-create
// (photoreal AI model reference images). Replaces Gemini for both.
//
// Async REST contract (same for every tool):
//   POST {base}/run    { model_name, inputs }            -> { id }
//   GET  {base}/status/{id}                              -> { status, output:[url], error }
//   statuses: starting | in_queue | processing | completed | failed
//   inputs accept public image URLs (our Cloudinary URLs work directly).
//
// Docs: https://docs.fashn.ai/api-reference/tryon-v1-6
//       https://docs.fashn.ai/api-reference/model-create

const FASHN_BASE = (process.env.FASHN_BASE_URL || 'https://api.fashn.ai/v1').replace(/\/$/, '');
const TRYON_MODEL = process.env.FASHN_MODEL || 'tryon-v1.6';

function ensureConfigured() {
  if (!process.env.FASHN_API_KEY) {
    throw new Error('FASHN_API_KEY is not set — set it in Railway environment variables.');
  }
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.FASHN_API_KEY}`,
  };
}

// Map our product-category slug → a FASHN try-on category. 'auto' lets FASHN
// detect; we only override when the slug is unambiguous.
function fashnCategoryFor(slug) {
  const s = (slug || '').toLowerCase();
  if (/(robe|dress|kimono|slip|pyjama|pajama|nightdress|nightgown|jumpsuit|one-?piece|romper)/.test(s)) return 'one-pieces';
  if (/(short|boxer|brief|knicker|pant|trouser|bottom|skirt)/.test(s)) return 'bottoms';
  if (/(shirt|nightshirt|top|cami|blouse|tee|sweater)/.test(s)) return 'tops';
  return 'auto';
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Submit one job to FASHN and poll until it returns an output image URL.
// Quality mode runs ~12-17s (plus any queue); poll every 2s, cap at 120s.
async function runAndPoll(modelName, inputs) {
  ensureConfigured();
  const headers = authHeaders();
  const t0 = Date.now();
  console.log(`[fashn] START ${modelName}`);

  const runRes = await fetch(`${FASHN_BASE}/run`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model_name: modelName, inputs }),
  });
  if (!runRes.ok) {
    const body = await runRes.text().catch(() => '');
    throw new Error(`FASHN run failed (${runRes.status}): ${body.slice(0, 200)}`);
  }
  const runJson = await runRes.json();
  const id = runJson.id;
  if (!id) throw new Error(`FASHN run returned no id: ${JSON.stringify(runJson).slice(0, 200)}`);

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    await sleep(2000);
    const stRes = await fetch(`${FASHN_BASE}/status/${id}`, { headers });
    if (!stRes.ok) continue;
    const st = await stRes.json();

    if (st.status === 'completed') {
      const imageUrl = Array.isArray(st.output) ? st.output[0] : st.output;
      if (!imageUrl) throw new Error('FASHN completed but returned no output image');
      console.log(`[fashn] DONE ${modelName} in ${Date.now() - t0}ms — ${imageUrl}`);
      return { imageUrl, elapsedMs: Date.now() - t0 };
    }
    if (st.status === 'failed' || st.status === 'error') {
      throw new Error(`FASHN generation failed: ${st.error || 'unknown error'}`);
    }
    // starting | in_queue | processing → keep polling
  }
  throw new Error('FASHN generation timed out after 120s');
}

/**
 * Virtual try-on: put `garment_image` onto `model_image`.
 * @returns {{ imageUrl, seed, cost, elapsedMs, provider }}
 */
async function generateTryOn({ modelImageUrl, garmentImageUrl, category = 'auto', seed }) {
  if (!modelImageUrl || !garmentImageUrl) {
    throw new Error('modelImageUrl and garmentImageUrl are required');
  }
  // Quality-tuned defaults:
  //  - mode 'quality' = FASHN's best render (12-17s) vs the faster default
  //  - output_format 'png' = highest quality (no jpeg compression)
  //  - moderation_level 'permissive' = don't block our briefs/boxers/lingerie
  //    (the default 'conservative' rejects underwear & swimwear)
  const inputs = {
    model_image: modelImageUrl,
    garment_image: garmentImageUrl,
    category,
    mode: process.env.FASHN_MODE || 'quality',
    garment_photo_type: 'auto',
    output_format: 'png',
    moderation_level: 'permissive',
  };
  if (Number.isInteger(seed)) inputs.seed = seed;

  const { imageUrl, elapsedMs } = await runAndPoll(TRYON_MODEL, inputs);
  return { imageUrl, seed: seed ?? null, cost: 0.08, elapsedMs, provider: `fashn-${TRYON_MODEL}` };
}

/**
 * model-create: generate a photoreal fashion model from a text prompt. Used
 * for AI-model reference photos (the person try-on then dresses).
 * @returns {{ imageUrl, elapsedMs, provider }}
 */
async function generateModel({ prompt, aspectRatio = '2:3', seed }) {
  if (!prompt) throw new Error('prompt is required');
  const inputs = { prompt, aspect_ratio: aspectRatio };
  if (Number.isInteger(seed)) inputs.seed = seed;

  const { imageUrl, elapsedMs } = await runAndPoll('model-create', inputs);
  return { imageUrl, elapsedMs, provider: 'fashn-model-create' };
}

module.exports = { generateTryOn, generateModel, fashnCategoryFor };
