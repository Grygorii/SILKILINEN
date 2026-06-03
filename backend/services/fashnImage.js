// FASHN.ai virtual try-on provider.
//
// Replaces Gemini as the AI-photoshoot engine. FASHN is a try-on API: it
// takes a model image (a person) + a garment image (the product) and returns
// the model wearing that exact garment — so garment fidelity is preserved
// (the blue robe stays blue), unlike open-ended generation.
//
// Async REST contract:
//   POST {base}/run    { model_name, inputs:{ model_image, garment_image,
//                        category, seed? } }            -> { id }
//   GET  {base}/status/{id}                             -> { status, output:[url], error }
//   statuses: starting | in_queue | processing | completed | failed
//   inputs accept public image URLs (our Cloudinary URLs work directly).
//
// Docs: https://docs.fashn.ai/api-reference/tryon-v1-6

const FASHN_BASE = (process.env.FASHN_BASE_URL || 'https://api.fashn.ai/v1').replace(/\/$/, '');
const MODEL_NAME = process.env.FASHN_MODEL || 'tryon-v1.6';

function ensureConfigured() {
  if (!process.env.FASHN_API_KEY) {
    throw new Error('FASHN_API_KEY is not set — set it in Railway environment variables.');
  }
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

/**
 * Run one virtual try-on and return the result image URL.
 * @returns {{ imageUrl: string, seed: number|null, cost: number, elapsedMs: number, provider: string }}
 */
async function generateTryOn({ modelImageUrl, garmentImageUrl, category = 'auto', seed }) {
  ensureConfigured();
  if (!modelImageUrl || !garmentImageUrl) {
    throw new Error('modelImageUrl and garmentImageUrl are required');
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.FASHN_API_KEY}`,
  };
  const inputs = { model_image: modelImageUrl, garment_image: garmentImageUrl, category };
  if (Number.isInteger(seed)) inputs.seed = seed;

  const t0 = Date.now();
  console.log(`[fashn] START try-on — model_name=${MODEL_NAME} category=${category}`);

  const runRes = await fetch(`${FASHN_BASE}/run`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model_name: MODEL_NAME, inputs }),
  });
  if (!runRes.ok) {
    const body = await runRes.text().catch(() => '');
    throw new Error(`FASHN run failed (${runRes.status}): ${body.slice(0, 200)}`);
  }
  const runJson = await runRes.json();
  const id = runJson.id;
  if (!id) throw new Error(`FASHN run returned no id: ${JSON.stringify(runJson).slice(0, 200)}`);

  // FASHN try-on completes in ~5-8s; poll every 2s and cap at 90s.
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    await sleep(2000);
    const stRes = await fetch(`${FASHN_BASE}/status/${id}`, { headers });
    if (!stRes.ok) continue;
    const st = await stRes.json();

    if (st.status === 'completed') {
      const imageUrl = Array.isArray(st.output) ? st.output[0] : st.output;
      if (!imageUrl) throw new Error('FASHN completed but returned no output image');
      console.log(`[fashn] DONE in ${Date.now() - t0}ms — ${imageUrl}`);
      return { imageUrl, seed: seed ?? null, cost: 0.08, elapsedMs: Date.now() - t0, provider: `fashn-${MODEL_NAME}` };
    }
    if (st.status === 'failed' || st.status === 'error') {
      throw new Error(`FASHN generation failed: ${st.error || 'unknown error'}`);
    }
    // starting | in_queue | processing → keep polling
  }
  throw new Error('FASHN generation timed out after 90s');
}

module.exports = { generateTryOn, fashnCategoryFor };
