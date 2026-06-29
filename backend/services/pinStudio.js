'use strict';

// Pin Studio — the distribution engine. Turns ANY of the brand's raw material —
// a journal ARTICLE, a PRODUCT, or a customer REVIEW — into 3 ready-to-post
// Pinterest pins, each with an AI image prompt (a scene; the text hook is added
// by hand since AI garbles text), a Pinterest-SEO title/description, keywords and
// a TRACKED link (utm_source=pinterest) so traffic is attributable. Pinterest is
// a search engine with long-lived pins — the highest-leverage durable channel for
// a visual luxury brand, and every pin points at a page that captures leads.

const JournalArticle = require('../models/JournalArticle');
const GrowthAction = require('../models/GrowthAction');
const { playbookPromptBlock } = require('./playbook');

const client = require('./aiClient'); // shared DeepSeek client
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const SITE = (process.env.FRONTEND_URL || 'https://www.silkilinen.com').replace(/\/$/, '');
const SOCIAL = ['pinterest', 'instagram', 'facebook', 'tiktok', 'social'];

function trackedLink(path, campaign) {
  return `${SITE}${path}?utm_source=pinterest&utm_medium=social&utm_campaign=${encodeURIComponent(campaign)}`;
}

const SYSTEM = `You are a senior Pinterest strategist for SILKILINEN, a quiet-luxury Mulberry-silk & linen house. Pinterest is a SEARCH ENGINE: titles and descriptions must be keyword-rich and specific, never salesy. You turn the given SOURCE into THREE distinct pins, each driving a searcher to the right page.

BRAND RULES (non-negotiable):
- Quiet luxury: considered, warm, specific (mulberry silk, 22 momme, slow mornings) — never "amazing/best/must-have", never urgent, never discount/sale language.
- NEVER state or imply products are made in Ireland/Donegal or are handmade — no "Irish linen", "made in Ireland". The brand is "an Irish brand based in Donegal"; product-origin claims are forbidden.
- British/Irish English.

ADAPT TO THE SOURCE TYPE:
- ARTICLE → drive to the guide; three angles (how-to, benefit, aesthetic).
- PRODUCT → shoppable pins: style the product itself in the image prompt (its colour, material, momme), benefit-led titles, descriptions that make a searcher want it.
- REVIEW → a tasteful TESTIMONIAL pin: the overlayHook is a short pull-quote from the customer's REAL words (in quotation marks — never invent or change them); the image prompt is an elegant quote-card scene (silk texture / a styled still with calm space for the quote); the description carries the social proof and points to the product.

For EACH of 3 pins produce:
- angle: the distinct approach.
- imagePrompt: a detailed prompt for an AI image model — a VERTICAL 2:3 (1000x1500) quiet-luxury scene fitting the source. Describe composition, palette, mood, lighting; leave calm negative space for a text overlay. Put NO text in the image itself.
- overlayHook: the short bold line to place ON the image by hand (<= 7 words).
- pinTitle: <= 100 chars, leads with the search keyword, calm but click-worthy.
- pinDescription: 2-3 sentences, <= 480 chars, keyword-rich for Pinterest search, ending with a soft invitation.
- keywords: 6-8 lowercase Pinterest search phrases (no # symbol).
- board: a short suggested board name.

Respond ONLY with valid JSON:
{ "pins": [ { "angle": "...", "imagePrompt": "...", "overlayHook": "...", "pinTitle": "...", "pinDescription": "...", "keywords": ["..."], "board": "..." } ] }`;

// Build the per-source context + the tracked destination link.
async function contextFor(type, id) {
  if (type === 'product') {
    const Product = require('../models/Product');
    const p = await Product.findById(id).select('name slug price category colours materialComposition momme description').lean().catch(() => null);
    if (!p) return { error: 'Product not found.' };
    const user = [
      `SOURCE TYPE: PRODUCT — make shoppable pins that drive to the product page.`,
      `NAME: ${p.name}`,
      p.price ? `PRICE: €${p.price}` : '',
      p.category ? `CATEGORY: ${p.category}` : '',
      p.colours?.length ? `COLOURS: ${p.colours.join(', ')}` : '',
      p.materialComposition ? `MATERIAL: ${p.materialComposition}` : '',
      p.momme ? `SILK WEIGHT: ${p.momme} momme` : '',
      p.description ? `DESCRIPTION: ${String(p.description).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600)}` : '',
    ].filter(Boolean).join('\n');
    return { user, link: trackedLink(`/product/${p.slug || id}`, p.slug || String(id)), displayTitle: p.name };
  }

  if (type === 'review') {
    const Review = require('../models/Review');
    const r = await Review.findById(id).select('reviewer message title starRating productId').lean().catch(() => null);
    if (!r) return { error: 'Review not found.' };
    let productName = '';
    let link = trackedLink('/', 'review');
    if (r.productId) {
      const Product = require('../models/Product');
      const p = await Product.findById(r.productId).select('name slug').lean().catch(() => null);
      if (p) { productName = p.name; link = trackedLink(`/product/${p.slug || r.productId}`, p.slug || String(r.productId)); }
    }
    const user = [
      `SOURCE TYPE: REVIEW — make a tasteful testimonial pin using the REAL words; never invent or alter them.`,
      `RATING: ${r.starRating}/5`,
      r.title ? `REVIEW TITLE: ${r.title}` : '',
      r.message ? `REVIEW TEXT: "${r.message}"` : '',
      `REVIEWER: ${r.reviewer}`,
      productName ? `ABOUT PRODUCT: ${productName}` : '',
    ].filter(Boolean).join('\n');
    return { user, link, displayTitle: `Review by ${r.reviewer}` };
  }

  // article (default)
  const a = await JournalArticle.findById(id).select('title slug excerpt body keywords').lean().catch(() => null);
  if (!a) return { error: 'Article not found.' };
  const body = String(a.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1500);
  const user = [
    `SOURCE TYPE: ARTICLE — drive searchers to the guide.`,
    `TITLE: ${a.title}`,
    a.keywords?.length ? `TARGET KEYWORDS: ${a.keywords.join(', ')}` : '',
    a.excerpt ? `EXCERPT: ${a.excerpt}` : '',
    `BODY: ${body}`,
  ].filter(Boolean).join('\n');
  return { user, link: trackedLink(`/journal/${a.slug}`, a.slug), displayTitle: a.title };
}

async function generatePins({ type, id }) {
  if (!process.env.DEEPSEEK_API_KEY) return { error: 'AI is not configured.' };
  const ctx = await contextFor(type, id);
  if (ctx.error) return ctx;

  const demand = await GrowthAction.find({ agent: 'demand', type: 'demand_signal' })
    .sort({ createdAt: -1 }).limit(8).select('meta').lean().catch(() => []);
  const demandPhrases = demand.map(a => a.meta?.phrase).filter(Boolean);
  const learned = await playbookPromptBlock().catch(() => '');

  const user = [
    ctx.user,
    demandPhrases.length ? `REAL RISING SEARCH DEMAND (lean in where natural): ${demandPhrases.join('; ')}` : '',
    learned,
    `Create 3 distinct Pinterest pins for this source. Return the JSON.`,
  ].filter(Boolean).join('\n\n');

  let parsed;
  try {
    const res = await client.chat.completions.create(
      { model: MODEL, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }], temperature: 0.7, max_tokens: 1600, response_format: { type: 'json_object' } },
      { timeout: 45000, maxRetries: 1 },
    );
    parsed = JSON.parse(res.choices[0]?.message?.content || '{}');
  } catch (err) {
    console.warn('[pin-studio] generation failed:', err.message);
    return { error: 'Pin generation failed — give it a moment and try again.' };
  }

  const pins = (Array.isArray(parsed.pins) ? parsed.pins : []).slice(0, 3).map(p => ({
    angle: String(p.angle || '').slice(0, 60),
    imagePrompt: String(p.imagePrompt || '').slice(0, 1200),
    overlayHook: String(p.overlayHook || '').slice(0, 90),
    pinTitle: String(p.pinTitle || '').slice(0, 100),
    pinDescription: String(p.pinDescription || '').slice(0, 500),
    keywords: Array.isArray(p.keywords) ? p.keywords.map(String).filter(Boolean).slice(0, 8) : [],
    board: String(p.board || '').slice(0, 60),
    link: ctx.link,
  })).filter(p => p.imagePrompt && p.pinTitle);

  if (!pins.length) return { error: 'No usable pins came back — try again.' };
  return { source: { type, title: ctx.displayTitle }, pins };
}

// The raw material the studio can draw from.
async function listSources() {
  const Product = require('../models/Product');
  const Review = require('../models/Review');
  const [articles, products, reviews] = await Promise.all([
    JournalArticle.find().sort({ status: 1, publishedAt: -1, createdAt: -1 }).limit(60).select('title status').lean().catch(() => []),
    Product.find({ status: { $in: ['active', 'sold_out'] } }).sort({ createdAt: -1 }).limit(60).select('name price').lean().catch(() => []),
    Review.find({ status: 'approved', message: { $ne: '' } }).sort({ createdAt: -1 }).limit(40).select('reviewer message title starRating').lean().catch(() => []),
  ]);
  return {
    article: articles.map(a => ({ id: String(a._id), label: a.title, note: a.status !== 'published' ? a.status : '' })),
    product: products.map(p => ({ id: String(p._id), label: `${p.name}`, note: p.price ? `€${p.price}` : '' })),
    review: reviews.map(r => ({ id: String(r._id), label: `${'★'.repeat(r.starRating)} ${(r.title || r.message).slice(0, 48)} — ${r.reviewer}`, note: '' })),
  };
}

// The performance loop — what the tracked pins actually drove. Visits in the last
// 30 days that arrived via a social UTM, by source and by campaign (the source
// asset). Closes the loop so posting becomes measured, not guessed.
async function socialTraffic() {
  const Visit = require('../models/Visit');
  const since = new Date(Date.now() - 30 * 86400000);
  const match = { createdAt: { $gte: since }, $or: [{ 'utm.medium': 'social' }, { 'utm.source': { $in: SOCIAL } }, { source: { $in: SOCIAL } }] };
  const [bySource, byCampaign] = await Promise.all([
    Visit.aggregate([
      { $match: match },
      { $group: { _id: { src: { $ifNull: ['$utm.source', '$source'] }, sess: '$sessionId' } } },
      { $group: { _id: '$_id.src', visits: { $sum: 1 } } },
      { $sort: { visits: -1 } }, { $limit: 6 },
    ]).catch(() => []),
    Visit.aggregate([
      { $match: { createdAt: { $gte: since }, 'utm.medium': 'social', 'utm.campaign': { $nin: [null, ''] } } },
      { $group: { _id: { c: '$utm.campaign', sess: '$sessionId' } } },
      { $group: { _id: '$_id.c', visits: { $sum: 1 } } },
      { $sort: { visits: -1 } }, { $limit: 6 },
    ]).catch(() => []),
  ]);
  return {
    total: bySource.reduce((s, r) => s + r.visits, 0),
    bySource: bySource.map(r => ({ source: r._id || 'unknown', visits: r.visits })),
    topCampaigns: byCampaign.map(r => ({ campaign: r._id, visits: r.visits })),
  };
}

module.exports = { generatePins, listSources, socialTraffic };
