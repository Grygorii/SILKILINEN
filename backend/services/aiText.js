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

// The subject of the SEO copy, by entity kind. The brand rules below are
// identical for every kind — only what the page IS changes. Keeping the product
// wording byte-for-byte means the long-standing product generator is unchanged.
const SUBJECTS = {
  product: 'product pages',
  category: 'category pages (a shop page that lists many silk pieces of one kind, e.g. all robes, all pillowcases)',
  collection: 'collection pages (a curated edit that groups several silk pieces around a theme)',
  page: 'static pages (e.g. an about, FAQ, gifting or contact page)',
};

function buildSEOSystemPrompt(kind = 'product') {
  const subject = SUBJECTS[kind] || SUBJECTS.product;
  return `You are an SEO copywriter for SILKILINEN, a small luxury silk and linen brand. SILKILINEN is an Irish brand based in Donegal, but products are made in mixed locations. NEVER state or imply where a product is manufactured (e.g. "made/hand-finished/crafted in Donegal/Ireland") — country of origin is not provided here and varies per product. Your job is to write meta titles, meta descriptions, URL slugs, image alt-text templates, and keywords for ${subject}.

BRAND VOICE — read carefully:
- Considered, slow, with quiet warmth
- Never aggressive, never salesy, never urgent
- Aspirational through specificity, not through gloss
- Real, not performative
- Sounds like a thoughtful friend who knows fabrics, not a marketing department

CRITICAL WRITING RULES:
- Meta title: USE the full 50-60 characters — do NOT stop at 35, the space is valuable SEO. Lead with the primary target keyword, then add ONE natural secondary descriptor before the " — SILKILINEN" suffix: material ("mulberry silk"), colour, weight ("22 momme"), or a key benefit. Never pad with filler, never repeat a word. Examples that work: "Mulberry Silk Pillowcase in Silver — SILKILINEN" / "Silk Kimono Robe, Sunset Copper — SILKILINEN". Too short / wasted space (AVOID): "Silver Silk Pillowcase — SILKILINEN". Wrong tone (AVOID): "BEST SILK ROBE!!!" / "Aoife Silk Robe | Free Shipping | Best Price"
- Meta description: USE 140-165 characters — do NOT stop at ~100, fill the snippet space. One or two calm sentences. Lead with the product + material, then add a SECOND concrete detail to use the space: the weave/momme, the skin-and-hair benefit, who it's for, or care. No padding, no fluff, no clichés. Do NOT state a country of manufacture or origin. Example that works: "A pure mulberry silk pillowcase in sage green, 22 momme — cool and smooth against skin, gentle on hair, and kind to your overnight skincare." Too short (AVOID, under 120 chars): "A cream silk pillowcase, gentle on skin and hair." Wrong tone (AVOID): "BUY THIS LUXURY SILK NIGHTSHIRT TODAY!"
- Slug: lowercase, hyphens only, no special chars, max 50 chars, no brand name in slug. Examples: "aoife-silk-robe-terracotta" / "silk-nightshirt-copper"
- Keywords: 3-7 specific terms. Lowercase. Real searches a customer would type. Do NOT use origin-based keywords (no "donegal silk", "irish silk", "handmade silk"). Examples that work: "silk nightshirt, copper silk pyjamas, mulberry silk sleepwear". Examples that DO NOT work: "best, luxury, premium, amazing, top"
- Alt text template: a reusable template for product images. Use {position} as a placeholder where the shot name goes. Do NOT include a place of manufacture. Example: "Aoife Silk Robe in Terracotta — {position} view, silk by SILKILINEN"

TARGET KEYWORDS: If the user message lists target keywords, they are researched search terms for THIS specific product. Weave the FIRST (primary) one into the meta title naturally — or a close variant, since the product name often already contains it — and let the meta description read naturally around the terms. NEVER list or stuff keywords, and never break brand voice to fit one in. Keep all provided keywords in your keywords output.

NEVER use these words: "amazing", "incredible", "best", "must-have", "top-rated", "ultimate", "perfect"

ALWAYS prefer specific over general: "mulberry silk" not "luxury fabric"; "slow mornings" not "everyday wear"

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
  // Non-product entities (category / collection / page) describe a page that
  // lists or frames many pieces, not a single item — so the prompt leads with
  // what the page IS and the pieces it gathers, not a material/price.
  if (input.kind && input.kind !== 'product') {
    const label = SUBJECTS[input.kind] ? input.kind : 'page';
    const parts = [
      `Generate SEO meta-data for this SILKILINEN ${label}:`,
      ``,
      `Name: ${input.name}`,
      `Description: ${input.description || '(no description provided)'}`,
    ];
    if (input.items && input.items.length) {
      parts.push(`Pieces on this page (for context — do NOT list them): ${(Array.isArray(input.items) ? input.items : [input.items]).slice(0, 12).join(', ')}`);
    }
    if (input.keywords && input.keywords.length) {
      const kw = Array.isArray(input.keywords) ? input.keywords.join(', ') : input.keywords;
      parts.push(
        ``,
        `TARGET KEYWORDS (real searches this page should answer — prioritise the FIRST): ${kw}`,
        `Work the primary keyword into the meta title naturally, the others into the description. Keep ALL of these in your keywords output. Do not stuff or break voice.`,
      );
    }
    if (input.guidance) {
      parts.push(``, `SPECIFIC GOAL (from the search-performance analysis — make the meta serve exactly this): ${input.guidance}`);
    }
    parts.push(
      ``,
      `Note: this page's URL slug is fixed — return the existing slug unchanged if given, else an empty string. Focus on the meta title, meta description and keywords.`,
      ``,
      `Return the JSON response now.`,
    );
    return parts.join('\n');
  }

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
    const kw = Array.isArray(input.keywords) ? input.keywords.join(', ') : input.keywords;
    parts.push(
      ``,
      `TARGET KEYWORDS (researched, authoritative — prioritise the FIRST): ${kw}`,
      `Work the primary keyword into the meta title naturally, and the others naturally into the description. Keep ALL of these in your keywords output; you may add up to 2 long-tail variants. Do not stuff or break voice.`,
    );
  }

  if (input.guidance) {
    parts.push(``, `SPECIFIC GOAL (from the search-performance analysis — make the meta serve exactly this): ${input.guidance}`);
  }
  parts.push(``, `Return the JSON response now.`);
  return parts.join('\n');
}

/**
 * Generate SEO meta-data for any storefront entity via DeepSeek.
 * input.kind ∈ 'product' | 'category' | 'collection' | 'page' (default 'product').
 * Returns { metaTitle, metaDescription, slug, keywords, altTextTemplate }.
 * Throws AIServiceError on failure.
 */
async function generateSEO(input) {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new AIServiceError('DEEPSEEK_API_KEY is not set', 'MISSING_KEY');
  }

  const kind = input.kind || 'product';
  const start = Date.now();
  try {
    const response = await deepseekClient.chat.completions.create({
      model: SEO_MODEL,
      messages: [
        { role: 'system', content: buildSEOSystemPrompt(kind) },
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

    console.log(`[aiText] SEO generated — ${kind}: "${input.name}", model: ${SEO_MODEL}, duration: ${Date.now() - start}ms`);

    // Preserve the operator's researched target keywords (research wins) and
    // append any new long-tail variants the model proposed, deduped, cap 10.
    // Done in code so a provided keyword can never be silently dropped,
    // regardless of what the model returns.
    const norm = k => String(k).trim().toLowerCase();
    const targets = (Array.isArray(input.keywords) ? input.keywords : []).map(norm).filter(Boolean);
    const generated = parsed.keywords.map(norm).filter(Boolean);
    const keywords = [...new Set([...targets, ...generated])].slice(0, 10);

    return {
      metaTitle:       parsed.metaTitle,
      metaDescription: parsed.metaDescription,
      slug:            parsed.slug            || '',
      keywords,
      altTextTemplate: parsed.altTextTemplate || '',
    };
  } catch (err) {
    console.error(`[aiText] SEO generation failed — ${kind}: "${input.name}", error: ${err.message}`);
    if (err instanceof AIServiceError) throw err;
    throw new AIServiceError(`AI text service error: ${err.message}`, 'PROVIDER_ERROR', err);
  }
}

// Back-compat wrapper — the product editor and bulk SEO have always called this.
function generateProductSEO(input) {
  return generateSEO({ ...input, kind: 'product' });
}

module.exports = { generateSEO, generateProductSEO, AIServiceError };
