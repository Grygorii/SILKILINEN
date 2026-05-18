const fal = require('@fal-ai/serverless-client');

function ensureConfigured() {
  if (!process.env.FAL_KEY) {
    throw new Error('FAL_KEY is not set — fal.ai image generation is unavailable. Set FAL_KEY in Railway environment variables.');
  }
  fal.config({ credentials: process.env.FAL_KEY });
}

const FLUX_PREAMBLE = (prompt) =>
  `Keep the woman's identity, hair, body, pose, and background exactly the same. Replace any existing clothing with: ${prompt}. The garment must match the described product precisely in colour, fabric texture, cut, and detail. Professional editorial fashion photography, soft natural studio light, high detail, sharp focus on fabric.`;

// aspect_ratio: Flux Kontext accepts '16:9', '9:16', '4:3', '3:4', '1:1', '21:9'
function resolveAspectRatio(outputSize) {
  if (!outputSize) return '3:4';
  const { width, height } = outputSize;
  if (!width || !height) return '3:4';
  const ratio = width / height;
  if (ratio < 0.8) return '3:4';
  if (ratio > 1.2) return '4:3';
  return '1:1';
}

/**
 * Generate an image via fal.ai Flux Kontext Pro.
 * @param {object} opts
 * @param {string}  opts.referenceImageUrl  - Cloudinary URL of the AI model reference photo
 * @param {string}  opts.prompt             - Garment description (ALWAYS_APPEND already included by caller via buildPrompt)
 * @param {object} [opts.outputSize]        - { width, height } for aspect ratio hint
 * @param {number} [opts.guidanceScale]     - Default 3.5
 * @returns {{ imageUrl: string, seed: number|null, cost: number, elapsedMs: number, provider: string }}
 */
async function generateImage({ referenceImageUrl, prompt, outputSize, guidanceScale = 3.5 }) {
  ensureConfigured();

  if (!referenceImageUrl) {
    throw new Error('referenceImageUrl is required for fal.ai Flux Kontext generation');
  }

  const fluxPrompt = FLUX_PREAMBLE(prompt);
  const aspect_ratio = resolveAspectRatio(outputSize);

  console.log(`[fal.ai] START — aspect_ratio=${aspect_ratio}`);
  const t0 = Date.now();

  const result = await fal.subscribe('fal-ai/flux-pro/kontext', {
    input: {
      image_url: referenceImageUrl,
      prompt: fluxPrompt,
      guidance_scale: guidanceScale,
      num_images: 1,
      output_format: 'jpeg',
      safety_tolerance: '6',
      aspect_ratio,
    },
    logs: false,
  });

  const elapsedMs = Date.now() - t0;
  const imageUrl = result?.images?.[0]?.url;
  if (!imageUrl) throw new Error('fal.ai returned no image URL');

  console.log(`[fal.ai] DONE in ${elapsedMs}ms — ${imageUrl}`);

  return {
    imageUrl,
    seed: result?.seed ?? null,
    cost: 0.04,
    elapsedMs,
    provider: 'fal-flux-kontext-pro',
  };
}

module.exports = { generateImage };
