const fal = require('@fal-ai/serverless-client');

function ensureConfigured() {
  if (!process.env.FAL_KEY) {
    throw new Error('FAL_KEY is not set — fal.ai image generation is unavailable. Set FAL_KEY in Railway environment variables.');
  }
  fal.config({ credentials: process.env.FAL_KEY });
}

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
 * Generate a product photo using fal.ai Flux Kontext [max] multi-image.
 *
 * image_urls order:
 *   [0] modelImageUrl   — AI model identity photo (the person/pose to preserve)
 *   [1] productImageUrl — actual product photo (the garment to apply)
 *
 * @param {object} opts
 * @param {string}  opts.modelImageUrl   - Cloudinary URL of the AI model reference photo
 * @param {string}  opts.productImageUrl - URL of the actual product (flat-lay or hero)
 * @param {string}  opts.prompt          - Composed prompt (from buildPrompt in aiPhotos.js)
 * @param {object} [opts.outputSize]     - { width, height } for aspect ratio hint
 * @param {number} [opts.guidanceScale]  - Default 3.5
 * @returns {{ imageUrl: string, seed: number|null, cost: number, elapsedMs: number, provider: string }}
 */
async function generateImage({ modelImageUrl, productImageUrl, prompt, outputSize, guidanceScale = 3.5, referenceImageUrl }) {
  if (referenceImageUrl !== undefined) {
    throw new Error(
      'falImage.generateImage: old signature detected (referenceImageUrl). ' +
      'Update the caller to pass { modelImageUrl, productImageUrl, prompt } instead.'
    );
  }

  ensureConfigured();

  if (!modelImageUrl || !productImageUrl || !prompt) {
    throw new Error('modelImageUrl, productImageUrl, and prompt are all required');
  }

  const fluxPrompt =
    `Show the woman from the first image wearing the garment from the second image. ` +
    `Preserve her face, hair, body proportions, and pose exactly. ` +
    `Preserve the garment's color, fabric texture, cut, stitching detail, and design elements exactly from the second image. ` +
    `${prompt}. ` +
    `Professional editorial fashion photography, soft natural studio light, sharp focus on fabric, high detail.`;

  const aspect_ratio = resolveAspectRatio(outputSize);

  console.log(`[fal.ai] START multi — aspect_ratio=${aspect_ratio}`);
  const t0 = Date.now();

  const result = await fal.subscribe('fal-ai/flux-pro/kontext/max/multi', {
    input: {
      image_urls: [modelImageUrl, productImageUrl],
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
    cost: 0.08,
    elapsedMs,
    provider: 'fal-flux-kontext-max-multi',
  };
}

module.exports = { generateImage };
