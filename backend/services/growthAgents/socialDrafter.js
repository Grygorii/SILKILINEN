'use strict';

// Social drafter — a Growth Engine specialist. Picks the freshest active
// products (and the newest published journal article, if any) and asks
// DeepSeek for two caption drafts: one Instagram, one Pinterest. Each draft
// is created as a real SocialPost with status 'draft', so it appears in
// Admin → Social exactly like a hand-started post, ready for the founder
// to review, edit and mark ready. Nothing is ever published automatically.

const OpenAI = require('openai');
const Product = require('../../models/Product');
const JournalArticle = require('../../models/JournalArticle');
const SocialPost = require('../../models/SocialPost');

const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

// DeepSeek is OpenAI-compatible — same pattern as services/aiText.js.
const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || 'not-set',
  baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
});

const SYSTEM_PROMPT = `You are the social media copywriter for SILKILINEN, a small luxury silk and linen brand. SILKILINEN is an Irish brand based in Donegal, but products are made in mixed locations.

BRAND VOICE:
- Considered, slow, with quiet warmth — quiet luxury.
- Never aggressive, never salesy, never urgent. No "BUY NOW", no "limited time", no exclamation-mark hype.
- Aspirational through specificity, not gloss: "mulberry silk", "22 momme", "slow mornings" — not "luxury fabric" or "everyday wear".
- Sounds like a thoughtful friend who knows fabrics, not a marketing department.
- British/Irish English throughout: colour not color, favourite not favorite.

HARD RULES:
- NEVER state or imply that products are handmade, hand-crafted or hand-finished.
- NEVER state or imply that products are made in Ireland or Donegal. The brand is "an Irish brand based in Donegal" — that phrasing is fine; product origin claims are not.
- NEVER use: "amazing", "incredible", "best", "must-have", "ultimate", "perfect".

TASK: write two caption drafts about the products (and journal article, if given).
1. "instagram" — warm and sensory. 2–3 short paragraphs separated by blank lines, then nothing else (hashtags go in their own field). Plus 5–8 tasteful, specific hashtags.
2. "pinterest" — searchable and descriptive, written for Pinterest's visual search: lead with what the item is and its material, one or two calm sentences on texture and use. Plus 3–5 keyword-style hashtags.

Hashtags: lowercase, no spaces, WITHOUT the leading # symbol. Specific over broad ("mulberrysilk", "silkpillowcase", "slowliving") and never origin-based ("irishlinen", "madeinireland", "handmade" are all forbidden).

RESPOND ONLY WITH VALID JSON in this exact shape:
{
  "instagram": { "caption": "...", "hashtags": ["...", "..."] },
  "pinterest": { "caption": "...", "hashtags": ["...", "..."] }
}
No commentary, no markdown, no code fences.`;

function primaryImage(product) {
  if (Array.isArray(product.images) && product.images.length) {
    const img = product.images.find(i => i.isPrimary) || product.images[0];
    return { url: img.url, altText: img.alt || product.name };
  }
  if (product.image) return { url: product.image, altText: product.altText || product.name };
  return null;
}

function buildUserPrompt(products, article) {
  const parts = ['Write the two caption drafts for this material:', ''];
  products.forEach((p, i) => {
    parts.push(`PRODUCT ${i + 1}: ${p.name}`);
    if (p.materialComposition) parts.push(`Material: ${p.materialComposition}`);
    if (p.momme) parts.push(`Silk weight: ${p.momme} momme`);
    if (p.colours && p.colours.length) parts.push(`Colours: ${p.colours.join(', ')}`);
    if (p.price) parts.push(`Price: €${p.price}`);
    if (p.description) parts.push(`Description: ${String(p.description).slice(0, 400)}`);
    parts.push('');
  });
  if (article) {
    parts.push(`LATEST JOURNAL ARTICLE (mention naturally if it fits, e.g. "new on the journal"): "${article.title}"`);
    if (article.excerpt) parts.push(`Excerpt: ${String(article.excerpt).slice(0, 300)}`);
    parts.push('');
  }
  parts.push('Return the JSON response now.');
  return parts.join('\n');
}

async function run() {
  if (!process.env.DEEPSEEK_API_KEY) {
    return [{ type: 'info', title: 'Skipped — AI not configured', status: 'info' }];
  }

  const [products, article] = await Promise.all([
    Product.find({ status: 'active' })
      .sort({ updatedAt: -1 })
      .limit(2)
      .select('name price description materialComposition momme colours images image altText')
      .lean(),
    JournalArticle.findOne({ status: 'published' })
      .sort({ publishedAt: -1, createdAt: -1 })
      .select('title excerpt slug')
      .lean(),
  ]);

  if (!products.length && !article) {
    return [{ type: 'info', title: 'Nothing to draft — no active products or published articles', status: 'info' }];
  }

  const subjectName = products[0] ? products[0].name : article.title;

  // Deterministic titles double as the dedupe key — if a non-posted auto-draft
  // for this subject already exists for a platform, don't draft it again.
  const platforms = [
    { key: 'instagram', title: `${subjectName} — Instagram (auto-draft)` },
    { key: 'pinterest', title: `${subjectName} — Pinterest (auto-draft)` },
  ];
  const needed = [];
  for (const p of platforms) {
    const exists = await SocialPost.exists({ title: p.title });
    if (!exists) needed.push(p);
  }
  if (!needed.length) {
    return [{
      type: 'info',
      title: `Nothing new to draft — social drafts already exist for "${subjectName}"`,
      status: 'info',
    }];
  }

  const response = await deepseek.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(products, article) },
    ],
    temperature: 0.7,
    max_tokens: 900,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Empty response from AI provider');
  const parsed = JSON.parse(content);

  const image = products[0] ? primaryImage(products[0]) : null;
  const actions = [];

  for (const p of needed) {
    const draft = parsed[p.key];
    if (!draft || !draft.caption) continue;
    const hashtags = (Array.isArray(draft.hashtags) ? draft.hashtags : [])
      .map(h => String(h).trim().replace(/^#/, ''))
      .filter(Boolean);

    const post = await SocialPost.create({
      title: p.title,
      defaultCaption: draft.caption,
      defaultHashtags: hashtags,
      defaultImages: image ? [{ url: image.url, altText: image.altText }] : [],
      platformVariations: [{ platformKey: p.key, enabled: true }],
      status: 'draft',
      lastEditedBy: 'growth-engine',
    });

    actions.push({
      type: 'social_draft',
      title: `${p.key === 'instagram' ? 'Instagram' : 'Pinterest'} caption drafted — ${subjectName}`,
      detail: draft.caption.slice(0, 200),
      href: `/admin/social/${post._id}`,
      status: 'needs_approval',
      meta: { postId: String(post._id), platform: p.key, products: products.map(x => String(x._id)) },
    });
  }

  if (!actions.length) {
    throw new Error('AI response contained no usable captions');
  }
  return actions;
}

module.exports = {
  name: 'social',
  label: 'Social drafter',
  description: 'Drafts Instagram and Pinterest captions for the freshest active products (and the newest journal article) as draft posts in Admin → Social, ready for review.',
  cadenceHours: 72,
  defaultEnabled: true,
  run,
};
