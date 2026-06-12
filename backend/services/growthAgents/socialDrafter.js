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
1. "instagram" — this must read like writing, not a product sheet. NEVER open with the product name, material or specs. Open inside a small sensory moment or feeling the piece belongs to (the cool side of the bed, the hour before guests arrive, the first bare-legged morning of spring). Let the product enter the scene naturally in the second or third sentence. ONE material detail maximum, placed late and worn lightly ("19-momme mulberry silk" as an aside, not a headline). No feature lists, no "Also:" cross-sells, no colon-led constructions. 2–3 short paragraphs, blank lines between. Plus 5–8 tasteful, specific hashtags.
2. "pinterest" — Pinterest is a search engine, so here be descriptive: lead with what the item is and its material, one or two calm sentences on texture and use. Still prose, never a spec list. Plus 3–5 keyword-style hashtags.

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

  // Data-driven subject choice: rank active products by what shoppers are
  // actually doing — product-page views (last 14 days, own analytics) and
  // units sold (last 30 days). The winner gets the post; the reasoning is
  // shown in the pulse feed so the decision is auditable, not vibes.
  const Visit = require('../../models/Visit');
  const Order = require('../../models/Order');
  const since14 = new Date(Date.now() - 14 * 86400000);
  const since30 = new Date(Date.now() - 30 * 86400000);

  const [viewRows, saleRows, activeProducts, article] = await Promise.all([
    Visit.aggregate([
      { $match: { createdAt: { $gte: since14 }, productId: { $ne: null } } },
      { $group: { _id: '$productId', views: { $sum: 1 } } },
    ]).catch(() => []),
    Order.aggregate([
      { $match: { status: { $in: ['paid', 'shipped', 'delivered'] }, createdAt: { $gte: since30 } } },
      { $unwind: '$items' },
      { $match: { 'items.productId': { $ne: null } } },
      { $group: { _id: '$items.productId', units: { $sum: '$items.quantity' } } },
    ]).catch(() => []),
    Product.find({ status: 'active' })
      .select('name price description materialComposition momme colours images image altText updatedAt')
      .lean(),
    JournalArticle.findOne({ status: 'published' })
      .sort({ publishedAt: -1, createdAt: -1 })
      .select('title excerpt slug')
      .lean(),
  ]);

  if (!activeProducts.length && !article) {
    return [{ type: 'info', title: 'Nothing to draft — no active products or published articles', status: 'info' }];
  }

  const views = new Map(viewRows.map(r => [String(r._id), r.views]));
  const sales = new Map(saleRows.map(r => [String(r._id), r.units]));
  const scored = activeProducts
    .map(p => {
      const v = views.get(String(p._id)) || 0;
      const u = sales.get(String(p._id)) || 0;
      // A sale is worth far more signal than a view; recency breaks ties.
      return { p, v, u, score: v + u * 25 };
    })
    .sort((a, b) => b.score - a.score || new Date(b.p.updatedAt) - new Date(a.p.updatedAt));

  const products = scored.slice(0, 2).map(s => s.p);
  const top = scored[0];
  const reasoning = top && top.score > 0
    ? `Chosen by data: "${top.p.name}" — ${top.v} product view(s) in 14d, ${top.u} sold in 30d`
    : 'No view/sales signal yet — chose the newest active product';

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
      detail: `${reasoning}. "${draft.caption.slice(0, 180)}…"`,
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
