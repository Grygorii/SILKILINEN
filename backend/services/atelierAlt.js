'use strict';

// THE ATELIER'S EYE, pointed at the catalogue. The Atelier already SEES the
// rendered site via Gemini Vision; here it looks at each PRODUCT PHOTO directly
// and writes the descriptive alt text the Site Audit (and Google, and screen
// readers) keep asking for. This is the one audit finding an agent can truly
// auto-fix: it has eyes, and a missing alt is strictly worse than an imperfect
// one — so we apply it automatically. The founder can always refine any line in
// the product editor.
//
// Inert (returns a clear note) until GEMINI_API_KEY is set. Fail-soft per image
// so one unreachable photo can't sink the whole pass.

const { GoogleGenAI } = require('@google/genai');
const Product = require('../models/Product');

const VISION_MODEL = process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash';

function visionConfigured() { return Boolean(process.env.GEMINI_API_KEY); }
function genai() { return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }); }

// An alt is "weak" if it's absent, empty, a 1–2 char placeholder, or just the
// bare product name echoed back (no descriptive detail — colour, view, garment).
function isWeakAlt(alt, productName) {
  const a = String(alt || '').trim();
  if (a.length <= 2) return true;
  if (productName && a.toLowerCase() === String(productName).trim().toLowerCase()) return true;
  return false;
}

const ALT_SYSTEM = `You write ALT TEXT for product photos on SILKILINEN, a quiet-luxury Mulberry-silk & European-linen intimates brand. Look at the photo and write ONE concise, factual line (about 6–12 words) describing what is actually shown: the garment type, its colour, and the view or notable detail (e.g. front, back, lace trim, on-body, flat-lay, fabric close-up). Be specific and true to the image — never invent a colour or detail you can't see. Do NOT start with "image of"/"photo of"/"picture of". No marketing adjectives, no brand name, no quotes. Respond ONLY with JSON: { "alt": "the alt text" }`;

async function fetchImageBytes(url) {
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 500) throw new Error('image too small');
  const mimeType = res.headers.get('content-type') || 'image/jpeg';
  return { data: buf.toString('base64'), mimeType };
}

// Ask Gemini Vision for one alt line for one image.
async function describeImage(url, product) {
  const { data, mimeType } = await fetchImageBytes(url);
  const ctx = `Product: ${product.name}. Category: ${product.category || 'silk'}. ${product.colours?.length ? 'Colours offered: ' + product.colours.join(', ') + '.' : ''}`;
  const result = await genai().models.generateContent({
    model: VISION_MODEL,
    contents: [{ role: 'user', parts: [
      { text: `${ALT_SYSTEM}\n\n${ctx}` },
      { inlineData: { mimeType, data } },
    ] }],
    config: { responseMimeType: 'application/json', temperature: 0.3, maxOutputTokens: 120, thinkingConfig: { thinkingBudget: 0 } },
  });
  const text = result.text || result.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '{}';
  const alt = String(JSON.parse(text).alt || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  if (!alt || alt.length <= 2) throw new Error('empty alt returned');
  return alt;
}

// Walk active products, fill in weak/missing alt on their images. `force` also
// rewrites alts that already look fine (a full re-pass). `limit` caps how many
// IMAGES we touch in one run so the Gemini quota isn't blown in a single click.
async function generateAltText({ force = false, limit = 120 } = {}) {
  if (!visionConfigured()) {
    return { ran: false, note: 'The Atelier has no eyes yet — set GEMINI_API_KEY in Railway to let it write alt text.' };
  }

  const products = await Product.find({ status: { $in: ['active', 'sold_out'] }, 'images.0': { $exists: true } })
    .select('name category colours images').sort({ updatedAt: -1 });

  let scanned = 0, updated = 0, productsTouched = 0, failed = 0;
  const samples = [];

  for (const product of products) {
    if (updated >= limit) break;
    let dirty = false;
    for (const img of product.images) {
      if (updated >= limit) break;
      if (!img.url) continue;
      scanned++;
      if (!force && !isWeakAlt(img.alt, product.name)) continue;
      try {
        const alt = await describeImage(img.url, product);
        img.alt = alt;
        dirty = true; updated++;
        if (samples.length < 12) samples.push({ product: product.name, alt });
      } catch (err) {
        failed++;
        if (samples.length < 12) samples.push({ product: product.name, error: err.message.slice(0, 60) });
      }
    }
    if (dirty) {
      // validateBeforeSave: false — we only touched image alt; don't re-run the
      // full product validation (and don't trip the slug/stock pre-save churn).
      try { await product.save({ validateBeforeSave: false }); productsTouched++; }
      catch (err) { console.error('[atelierAlt] save failed for', product._id, err.message); }
    }
  }

  return { ran: true, force, scanned, updated, productsTouched, failed, hitLimit: updated >= limit, samples };
}

// How many images would a default pass touch right now? (For the audit + the
// admin button to show "12 photos need alt text" before running.)
async function countWeakAlt() {
  const products = await Product.find({ status: { $in: ['active', 'sold_out'] }, 'images.0': { $exists: true } })
    .select('name images').lean();
  let weak = 0, total = 0;
  for (const p of products) {
    for (const img of (p.images || [])) {
      if (!img.url) continue;
      total++;
      if (isWeakAlt(img.alt, p.name)) weak++;
    }
  }
  return { weak, total };
}

module.exports = { generateAltText, countWeakAlt, visionConfigured, isWeakAlt };
