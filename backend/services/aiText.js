const OpenAI = require('openai');

// DeepSeek is OpenAI-compatible — use the OpenAI SDK pointed at DeepSeek's endpoint.
const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || 'not-set',
  baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
});

const SEO_MODEL = process.env.DEEPSEEK_MODEL_SEO || 'deepseek-chat';

class AIServiceError extends Error {
  constructor(message, code, cause) {
    super(message);
    this.name = 'AIServiceError';
    this.code = code;
    this.cause = cause;
  }
}

function buildSEOSystemPrompt() {
  return `You are an SEO copywriter for SILKILINEN, a small luxury silk and linen brand made in Donegal, Ireland. Your job is to write meta titles, meta descriptions, URL slugs, image alt-text templates, and keywords for product pages.

BRAND VOICE — read carefully:
- Considered, slow, with quiet warmth
- Never aggressive, never salesy, never urgent
- Aspirational through specificity, not through gloss
- Real, not performative
- Sounds like a thoughtful friend who knows fabrics, not a marketing department

CRITICAL WRITING RULES:
- Meta title: 50-60 characters. Include product name + brand. Calm, descriptive. Examples that work: "Aoife Silk Robe in Terracotta — SILKILINEN" / "Silk Nightshirt, Sunset Copper — SILKILINEN". Examples that DO NOT work: "BEST SILK ROBE!!!" / "Buy Now — Luxury Silk Robe — Sale!!!" / "Aoife Silk Robe | Free Shipping | Best Price"
- Meta description: 140-160 characters. One sentence. Describe the product calmly and concretely. Mention material, place of origin (Donegal, Ireland), and one specific quality. Examples that work: "A copper-toned silk nightshirt, hand-finished in Donegal. Lightweight mulberry silk, designed for slow mornings and quiet evenings." Examples that DO NOT work: "BUY THIS LUXURY SILK NIGHTSHIRT TODAY!" / "Discover the magic of premium silk in our amazing nightshirt collection!"
- Slug: lowercase, hyphens only, no special chars, max 50 chars, no brand name in slug. Examples: "aoife-silk-robe-terracotta" / "silk-nightshirt-copper"
- Keywords: 3-7 specific terms. Lowercase. Real searches a customer would type. Examples that work: "silk nightshirt, copper silk pyjamas, luxury sleepwear ireland, handmade silk, donegal silk". Examples that DO NOT work: "best, luxury, premium, amazing, top"
- Alt text template: a reusable template for product images. Use {position} as a placeholder where the shot name goes. Example: "Aoife Silk Robe in Terracotta — {position} view, handmade silk by SILKILINEN Donegal"

NEVER use these words: "amazing", "incredible", "best", "must-have", "top-rated", "ultimate", "perfect"

ALWAYS prefer specific over general: "mulberry silk" not "luxury fabric"; "Donegal" not "Ireland"; "slow mornings" not "everyday wear"

Use British English: colour not color, programme not program.

RESPOND ONLY WITH VALID JSON in this exact shape:
{
  "metaTitle": "...",
  "metaDescription": "...",
  "slug": "...",
  "keywords": ["...", "...", "..."],
  "altTextTemplate": "..."
}

No commentary, no markdown, no code fences. Just the JSON object.`;
}

function buildSEOUserPrompt(input) {
  const parts = [
    `Generate SEO meta-data for this SILKILINEN product:`,
    ``,
    `Product name: ${input.name}`,
    `Category: ${input.category || 'silk apparel'}`,
    `Description: ${input.description || '(no description provided)'}`,
  ];

  if (input.materialComposition) parts.push(`Material: ${input.materialComposition}`);
  if (input.colours && input.colours.length) {
    parts.push(`Colours: ${Array.isArray(input.colours) ? input.colours.join(', ') : input.colours}`);
  }
  if (input.price) parts.push(`Price: €${input.price}`);
  if (input.keywords && input.keywords.length) {
    parts.push(``, `Existing keywords (use as hints): ${Array.isArray(input.keywords) ? input.keywords.join(', ') : input.keywords}`);
  }

  parts.push(``, `Return the JSON response now.`);
  return parts.join('\n');
}

/**
 * Generate SEO meta-data for a product via DeepSeek.
 * Returns { metaTitle, metaDescription, slug, keywords, altTextTemplate }.
 * Throws AIServiceError on failure.
 */
async function generateProductSEO(input) {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new AIServiceError('DEEPSEEK_API_KEY is not set', 'MISSING_KEY');
  }

  const start = Date.now();
  try {
    const response = await deepseekClient.chat.completions.create({
      model: SEO_MODEL,
      messages: [
        { role: 'system', content: buildSEOSystemPrompt() },
        { role: 'user',   content: buildSEOUserPrompt(input) },
      ],
      temperature: 0.7,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new AIServiceError('Empty response from AI provider', 'EMPTY_RESPONSE');

    const parsed = JSON.parse(content);

    if (!parsed.metaTitle || !parsed.metaDescription || !Array.isArray(parsed.keywords)) {
      throw new AIServiceError('Invalid response shape from AI provider', 'INVALID_SHAPE');
    }

    console.log(`[aiText] SEO generated — product: "${input.name}", model: ${SEO_MODEL}, duration: ${Date.now() - start}ms`);

    return {
      metaTitle:       parsed.metaTitle,
      metaDescription: parsed.metaDescription,
      slug:            parsed.slug            || '',
      keywords:        parsed.keywords,
      altTextTemplate: parsed.altTextTemplate || '',
    };
  } catch (err) {
    console.error(`[aiText] SEO generation failed — product: "${input.name}", error: ${err.message}`);
    if (err instanceof AIServiceError) throw err;
    throw new AIServiceError(`AI text service error: ${err.message}`, 'PROVIDER_ERROR', err);
  }
}

module.exports = { generateProductSEO, AIServiceError };
