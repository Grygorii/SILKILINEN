'use strict';

// THE ATELIER — the storefront-experience house. Its lead is an AI CREATIVE
// DIRECTOR with real eyes: it walks EVERY room of the site (homepage, shop,
// product, collection, journal, the quiz, the story pages), looking at the
// actual RENDERED page via a screenshot + Gemini Vision, and judges whether the
// whole villa is flawless — because one cardboard room ends the visit. It then
// names the weakest room and the cross-house plan, benchmarked against the great
// luxury houses.
//
// Grounded in what it SEES (rendered screenshots), page load (a slow room feels
// cheap), and real visitor behaviour. Inert with a clear message until
// GEMINI_API_KEY is set; every room is fail-soft so one bad page can't sink the
// whole review.

const { GoogleGenAI } = require('@google/genai');
const ExperienceReview = require('../models/ExperienceReview');
const Product = require('../models/Product');
const { capture } = require('./screenshot');
const { fetchReadablePage } = require('./externalData');
const textClient = require('./aiClient'); // DeepSeek, for the text synthesis
const TEXT_MODEL = process.env.DEEPSEEK_MODEL_ANALYST || 'deepseek-chat';

const VISION_MODEL = process.env.GEMINI_VISION_MODEL || 'gemini-2.0-flash';
const SITE = (process.env.FRONTEND_URL || 'https://www.silkilinen.com').replace(/\/$/, '');

function visionConfigured() { return Boolean(process.env.GEMINI_API_KEY); }
function genai() { return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }); }
const clampScore = v => Math.max(0, Math.min(10, Math.round((Number(v) || 0) * 10) / 10));
const str = (x, n = 400) => String(x == null ? '' : x).slice(0, n);

function coerceDiss(arr) {
  return (Array.isArray(arr) ? arr : []).slice(0, 4).map(d => ({
    what: str(d?.what, 280), why: str(d?.why, 280), fix: str(d?.fix, 280),
    severity: ['high', 'medium', 'low'].includes(d?.severity) ? d.severity : 'medium',
  }));
}

// The rooms of the villa — static pages + one live example of each dynamic
// template, resolved from the catalogue so the review is of the REAL pages.
async function resolveRooms() {
  const rooms = [
    { name: 'Homepage — the entrance', path: '/' },
    { name: 'Shop — the gallery', path: '/shop' },
    { name: 'Style Finder — the experience', path: '/style-finder' },
    { name: 'Journal — the editorial', path: '/journal' },
    { name: 'About — the story', path: '/about' },
  ];
  const product = await Product.findOne({ status: 'active', 'images.0.url': { $type: 'string', $ne: '' } })
    .sort({ isNewArrival: -1, createdAt: -1 }).select('_id name').lean().catch(() => null);
  if (product) rooms.splice(2, 0, { name: `Product page — "${product.name}"`, path: `/product/${product._id}` });
  const coll = await require('../models/Collection').findOne({ status: 'active', slug: { $nin: [null, ''] } }).select('slug name').lean().catch(() => null);
  if (coll?.slug) rooms.push({ name: `Collection — "${coll.name}"`, path: `/collections/${coll.slug}` });
  const art = await require('../models/JournalArticle').findOne({ status: 'published', slug: { $nin: [null, ''] } }).select('slug title').lean().catch(() => null);
  if (art?.slug) rooms.push({ name: `Journal article — "${art.title}"`, path: `/journal/${art.slug}` });
  return rooms.slice(0, 8);
}

const ROOM_SYSTEM = `You are the CREATIVE DIRECTOR of a great luxury house (the eye behind Hermès, Loro Piana, Brunello Cucinelli). You are inspecting ONE page ("room") of SILKILINEN, a quiet-luxury Mulberry-silk & European-linen intimates brand. Judge this room the way the most discerning buyer on earth would in 3 seconds: does it feel expensive, calm, considered, effortless — or is there DISSONANCE (anything that reads cheap, generic, busy, broken, slow, off-brand) that would make them leave? Quiet luxury = restraint, light, space, impeccable craft — never discount energy, never clutter. Be brutally honest but specific: name the exact element and the exact fix. Respond ONLY with JSON:
{ "score": 1-10, "verdict": "one honest sentence about this room", "dissonances": [ { "what": "exact element", "why": "why it cheapens it", "fix": "the precise correction", "severity": "high|medium|low" } ] }
0-2 dissonances if the room is strong; up to 4 if weak. Ground every point in what you SEE.`;

async function reviewRoom(room) {
  const url = `${SITE}${room.path}`;
  // Page load — a slow/heavy room feels cheap, so the director should know it.
  let loadMs = 0, htmlKB = 0;
  const t0 = Date.now();
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'SILKILINEN-Atelier/1.0' } });
    htmlKB = Math.round(((await r.text()) || '').length / 1024); loadMs = Date.now() - t0;
  } catch { loadMs = Date.now() - t0; }

  const shot = await capture(url, { width: 1280 });
  const parts = [{ text: `${ROOM_SYSTEM}\n\nROOM: ${room.name}\nURL: ${url}\nLOAD: ~${loadMs} ms, HTML ${htmlKB} KB (a slow or heavy room undermines luxury).` }];
  let usedScreenshot = false;
  if (shot) {
    parts.push({ text: '\nThe RENDERED page (judge what you see):' });
    parts.push({ inlineData: { mimeType: shot.mimeType, data: shot.data } });
    usedScreenshot = true;
  } else {
    const text = await fetchReadablePage(url, 2200).catch(() => '');
    parts.push({ text: `\n(No screenshot available — judge from the page's content & structure:)\n${(text || '').slice(0, 2000)}` });
  }

  const result = await genai().models.generateContent({
    model: VISION_MODEL,
    contents: [{ role: 'user', parts }],
    config: { responseMimeType: 'application/json', temperature: 0.4, maxOutputTokens: 900 },
  });
  const text = result.text || result.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '{}';
  const parsed = JSON.parse(text);
  return {
    name: room.name, path: room.path, score: clampScore(parsed.score),
    verdict: str(parsed.verdict, 300), dissonances: coerceDiss(parsed.dissonances),
    usedScreenshot, loadMs,
  };
}

const SYNTH_SYSTEM = `You are the CREATIVE DIRECTOR summarising a full walk-through of the SILKILINEN site, room by room. You are given each room's score and dissonances. Produce the HOUSE verdict for a quiet-luxury brand. CRITICAL RULE: a villa is only as good as its WORST room — one cardboard room ends the visit — so weight the weakest rooms heavily; do NOT average away a bad room. Respond ONLY with JSON:
{
  "wowScore": 1-10 (the WHOLE house, worst-room-weighted),
  "weakestRoom": "the room name that most lets the house down",
  "verdict": "one honest sentence on the whole experience",
  "firstImpression": "2-3 sentences: does walking this site feel like the villa of the most discerning person on earth?",
  "strengths": ["what already reads as luxury across the house — be fair"],
  "dissonances": [ { "what": "the worst issues across the whole site", "why": "", "fix": "", "severity": "high|medium|low" } ],
  "fixes": [ { "title": "the move", "where": "which room/page", "how": "concretely", "agent": "Photographer|Art Director|Maui|Concierge|Curator|founder" } ],
  "benchmark": "1-2 sentences: how the house reads next to Loro Piana / Brunello Cucinelli / Hermès, and the gap to close"
}
3-6 dissonances (worst-first), 3-6 fixes. Never suggest discounts, busy effects, or stock-photo clichés.`;

async function runHouseReview({ triggeredBy } = {}) {
  if (!visionConfigured()) {
    return ExperienceReview.create({
      scope: 'house', wowScore: 0, usedVision: false, usedFallback: true, triggeredBy: triggeredBy || '',
      verdict: 'The Atelier has no eyes yet — set GEMINI_API_KEY in Railway to let it see the site.',
      fixes: [{ title: 'Add GEMINI_API_KEY in Railway', where: 'env', how: 'The same Gemini key used for Image Studio gives the Atelier its eyes.', agent: 'founder' }],
    });
  }

  const rooms = await resolveRooms();
  const results = [];
  for (const room of rooms) {
    try { results.push(await reviewRoom(room)); }
    catch (err) {
      console.error(`[atelier] room ${room.path} failed:`, err.message);
      results.push({ name: room.name, path: room.path, score: 0, verdict: `Could not review this room (${err.message.slice(0, 80)}).`, dissonances: [], usedScreenshot: false, loadMs: 0 });
    }
  }

  // Synthesise the house verdict from the room critiques (text model).
  let synth = null;
  try {
    const roomsText = results.map(r => `• ${r.name} (${r.path}) — ${r.score}/10. ${r.verdict}${r.dissonances.length ? ' Issues: ' + r.dissonances.map(d => `${d.what} [${d.severity}]`).join('; ') : ''}`).join('\n');
    const res = await textClient.chat.completions.create({
      model: TEXT_MODEL,
      messages: [{ role: 'system', content: SYNTH_SYSTEM }, { role: 'user', content: `Room-by-room walk-through:\n${roomsText}\n\nWrite the house verdict JSON now.` }],
      temperature: 0.45, max_tokens: 1200, response_format: { type: 'json_object' },
    }, { timeout: 40000, maxRetries: 1 });
    synth = JSON.parse(res.choices[0]?.message?.content || '{}');
  } catch (err) {
    console.warn('[atelier] synthesis failed, using deterministic roll-up:', err.message);
  }

  // Deterministic fallback / safety net for the overall fields.
  const scored = results.filter(r => r.score > 0);
  const weakest = scored.length ? scored.reduce((a, b) => (b.score < a.score ? b : a)) : results[0];
  const avg = scored.length ? scored.reduce((s, r) => s + r.score, 0) / scored.length : 0;
  // Worst-room-weighted: pull the average toward the weakest room.
  const weighted = scored.length ? Math.round(((avg + (weakest?.score || 0)) / 2) * 10) / 10 : 0;

  return ExperienceReview.create({
    scope: 'house',
    wowScore: synth ? clampScore(synth.wowScore) : weighted,
    weakestRoom: str(synth?.weakestRoom || weakest?.name || '', 160),
    verdict: str(synth?.verdict || `Walked ${results.length} rooms; weakest is "${weakest?.name || '—'}".`, 400),
    firstImpression: str(synth?.firstImpression, 600),
    strengths: (Array.isArray(synth?.strengths) ? synth.strengths : []).map(s => str(s, 200)).slice(0, 6),
    dissonances: coerceDiss(synth?.dissonances).slice(0, 6),
    fixes: (Array.isArray(synth?.fixes) ? synth.fixes : []).slice(0, 6).map(f => ({
      title: str(f?.title, 200), where: str(f?.where, 160), how: str(f?.how, 300), agent: str(f?.agent, 40),
    })),
    benchmark: str(synth?.benchmark, 400),
    rooms: results,
    usedVision: results.some(r => r.usedScreenshot),
    usedFallback: !synth,
    triggeredBy: triggeredBy || '',
  });
}

// Back-compat alias.
module.exports = { runHouseReview, runEntranceReview: runHouseReview, visionConfigured };
