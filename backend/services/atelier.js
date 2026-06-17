'use strict';

// THE ATELIER — the storefront-experience house. Its lead is an AI CREATIVE
// DIRECTOR with real eyes: it pulls the live entrance imagery (homepage hero +
// product photography) and feeds it to Gemini Vision to judge whether opening
// the site feels like stepping into a villa, benchmarked against the great
// luxury houses. Grounded in what it SEES (vision) + the page structure + real
// visitor behaviour (the clickstream funnel) — not vibes.
//
// Honest about its limits: full-page screenshot critique (layout in the
// rendered browser) is a later stage; v1 reviews the actual hero + product
// images, which carry most of the "wow". Inert with a clear message until
// GEMINI_API_KEY is set.

const { GoogleGenAI } = require('@google/genai');
const ExperienceReview = require('../models/ExperienceReview');
const Product = require('../models/Product');
const SiteContent = require('../models/SiteContent');
const { gatherExperience } = require('./storefrontExperience');

const VISION_MODEL = process.env.GEMINI_VISION_MODEL || 'gemini-2.0-flash';

function visionConfigured() { return Boolean(process.env.GEMINI_API_KEY); }
function genai() { return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }); }

// Cloudinary transform to keep the vision payload light + consistent.
function sized(url, w = 1000) {
  return url && url.includes('/upload/') ? url.replace('/upload/', `/upload/w_${w},q_auto,f_auto/`) : url;
}

async function fetchInline(url) {
  try {
    const res = await fetch(sized(url), { signal: AbortSignal.timeout(9000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > 5 * 1024 * 1024) return null;
    return { mimeType: res.headers.get('content-type') || 'image/jpeg', data: buf.toString('base64'), url };
  } catch { return null; }
}

async function gatherEntranceAssets() {
  const heroDoc = await SiteContent.findOne({ key: 'homepage_hero_image', type: 'image' }).lean().catch(() => null);
  const products = await Product.find({ status: 'active', 'images.0.url': { $type: 'string', $ne: '' } })
    .select('name images').sort({ isNewArrival: -1, createdAt: -1 }).limit(4).lean().catch(() => []);

  const images = [];
  if (heroDoc?.value) images.push({ label: 'Homepage HERO — the entrance, the first thing a visitor sees', url: heroDoc.value });
  for (const p of products) {
    const primary = (p.images || []).find(i => i.isPrimary) || (p.images || [])[0];
    if (primary?.url) images.push({ label: `Product photo — "${p.name}"`, url: primary.url });
  }

  const [structure, clickstream] = await Promise.all([
    gatherExperience().catch(() => ''),
    require('./clickstream').getClickstreamSignals(14).catch(() => null),
  ]);
  return { images, structure, clickstream };
}

const SYSTEM = `You are the CREATIVE DIRECTOR of a great luxury house — the eye behind Hermès, Loro Piana, Brunello Cucinelli campaigns. You are reviewing the ENTRANCE to SILKILINEN, a quiet-luxury Mulberry-silk & European-linen intimates brand (designed in Ireland). You are shown the real homepage hero and product photography, the page structure, and how visitors behave.

Judge ONE thing: when a person opens this site, does it feel like stepping into the villa of the most discerning person on earth — calm, considered, expensive, effortless — or is there DISSONANCE that makes them leave in a second? Quiet luxury = restraint, light, space, impeccable craft; NOT more effects, never discount energy.

Be a brutally honest art director, but specific and constructive — every criticism must name the exact thing and the exact fix. Benchmark against the great houses. Respond ONLY with valid JSON:
{
  "wowScore": 1-10 (the honest entrance "wow"),
  "verdict": "one sentence — the honest state of the entrance",
  "firstImpression": "2-3 sentences: what the first 5 seconds actually feel like",
  "strengths": ["what already reads as luxury — be fair"],
  "dissonances": [ { "what": "the exact thing that cheapens it", "why": "why it breaks the luxury feel", "fix": "the precise correction", "severity": "high|medium|low" } ],
  "fixes": [ { "title": "the move", "where": "which surface/element", "how": "concretely", "agent": "Photographer|Art Director|Maui|Concierge|Curator|founder" } ],
  "benchmark": "1-2 sentences: how this reads next to Loro Piana / Brunello Cucinelli / Hermès, and the gap to close"
}
Rules: ground every point in what you SEE in the images and the structure. 3-6 dissonances, ranked worst-first. 3-6 fixes. Never suggest discounts, price-competing, busy effects, or stock-photo clichés.`;

function coerceArr(a) { return Array.isArray(a) ? a : []; }

async function runEntranceReview({ triggeredBy } = {}) {
  if (!visionConfigured()) {
    return ExperienceReview.create({
      wowScore: 0, usedVision: false, usedFallback: true, triggeredBy: triggeredBy || '',
      verdict: 'The Atelier has no eyes yet — set GEMINI_API_KEY in Railway to let it see the site.',
      firstImpression: 'Vision is not configured, so a visual review cannot run.',
      fixes: [{ title: 'Add GEMINI_API_KEY in Railway', where: 'env', how: 'The same Gemini key used for Image Studio gives the Atelier its eyes.', agent: 'founder' }],
    });
  }

  const { images, structure, clickstream } = await gatherEntranceAssets();
  if (!images.length) {
    return ExperienceReview.create({
      wowScore: 0, usedVision: false, usedFallback: true, triggeredBy: triggeredBy || '',
      verdict: 'No entrance imagery found to review — set the homepage hero and at least one active product.',
    });
  }

  // Interleave a label + the image, so the model knows what it's looking at.
  const parts = [];
  const cs = clickstream && clickstream.hasData
    ? `\n\nVISITOR BEHAVIOUR (last ${clickstream.days}d): ${clickstream.funnel.sessions} sessions, ${clickstream.funnel.viewedProduct} went on to view a product (${clickstream.funnel.sessions ? Math.round(clickstream.funnel.viewedProduct / clickstream.funnel.sessions * 100) : 0}%). A low rate means many leave at the entrance.`
    : '';
  parts.push({ text: `${SYSTEM}\n\nPAGE STRUCTURE:\n${(structure || '').slice(0, 2000)}${cs}\n\nNow the imagery to review:` });
  const reviewed = [];
  for (const img of images) {
    const inline = await fetchInline(img.url);
    if (!inline) continue;
    parts.push({ text: `\n${img.label}:` });
    parts.push({ inlineData: { mimeType: inline.mimeType, data: inline.data } });
    reviewed.push(img.url);
  }
  if (!reviewed.length) {
    return ExperienceReview.create({ wowScore: 0, usedVision: false, usedFallback: true, triggeredBy: triggeredBy || '', verdict: 'Could not load the entrance images to review — check the image URLs.' });
  }

  let parsed = null;
  try {
    const result = await genai().models.generateContent({
      model: VISION_MODEL,
      contents: [{ role: 'user', parts }],
      config: { responseMimeType: 'application/json', temperature: 0.45, maxOutputTokens: 1600 },
    });
    const text = result.text || result.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    parsed = JSON.parse(text);
  } catch (err) {
    console.error('[atelier] vision review failed:', err.message);
    throw new Error('The Atelier could not complete the review — try again in a moment.');
  }

  return ExperienceReview.create({
    wowScore: Math.max(0, Math.min(10, Number(parsed.wowScore) || 0)),
    verdict: String(parsed.verdict || '').slice(0, 400),
    firstImpression: String(parsed.firstImpression || '').slice(0, 600),
    strengths: coerceArr(parsed.strengths).map(String).slice(0, 6),
    dissonances: coerceArr(parsed.dissonances).slice(0, 6).map(d => ({
      what: String(d?.what || '').slice(0, 300), why: String(d?.why || '').slice(0, 300),
      fix: String(d?.fix || '').slice(0, 300),
      severity: ['high', 'medium', 'low'].includes(d?.severity) ? d.severity : 'medium',
    })),
    fixes: coerceArr(parsed.fixes).slice(0, 6).map(f => ({
      title: String(f?.title || '').slice(0, 200), where: String(f?.where || '').slice(0, 160),
      how: String(f?.how || '').slice(0, 300), agent: String(f?.agent || '').slice(0, 40),
    })),
    benchmark: String(parsed.benchmark || '').slice(0, 400),
    imagesReviewed: reviewed,
    usedVision: true, usedFallback: false,
    triggeredBy: triggeredBy || '',
  });
}

module.exports = { runEntranceReview, visionConfigured };
