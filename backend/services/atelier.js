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
const { curate, concierge, atmosphere } = require('./atelierCritics');
const textClient = require('./aiClient'); // DeepSeek, for the text synthesis
const TEXT_MODEL = process.env.DEEPSEEK_MODEL_ANALYST || 'deepseek-chat';

const VISION_MODEL = process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash';
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
    config: { responseMimeType: 'application/json', temperature: 0.4, maxOutputTokens: 1200, thinkingConfig: { thinkingBudget: 0 } },
  });
  const text = result.text || result.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '{}';
  const parsed = JSON.parse(text);
  return {
    name: room.name, path: room.path, score: clampScore(parsed.score),
    verdict: str(parsed.verdict, 300), dissonances: coerceDiss(parsed.dissonances),
    usedScreenshot, loadMs,
  };
}

const SYNTH_SYSTEM = `You are THE MAISON DIRECTOR — the person who DELIVERS the house. You're given a room-by-room walk-through AND four craft pillars (Look, Coherence, Voice, Speed), each scored. Produce the delivery verdict for a quiet-luxury brand. CRITICAL RULE: a villa is only as good as its WORST room and its WEAKEST pillar — one cardboard room or one slow door ends the visit — so weight the weakest heavily; NEVER average a bad room/pillar away. Your job is not just to critique but to DELIVER: a sequenced plan with an owner for each move and a clear standard. Respond ONLY with JSON:
{
  "wowScore": 1-10 (the whole house, worst-weighted across rooms AND pillars),
  "weakestRoom": "the room that most lets the house down",
  "verdict": "one honest sentence on whether this delivers the villa feeling",
  "firstImpression": "2-3 sentences: does walking this site feel like the home of the most discerning person on earth?",
  "strengths": ["what already reads as luxury — be fair"],
  "dissonances": [ { "what": "the worst issues across the whole house", "why": "", "fix": "", "severity": "high|medium|low" } ],
  "fixes": [ { "title": "the move", "where": "which room/pillar", "how": "concretely", "agent": "Photographer|Art Director|Curator|Concierge|Atmosphere|Maui|developer|founder" } ],
  "benchmark": "1-2 sentences: how the house reads next to Loro Piana / Brunello Cucinelli / Hermès, and the gap to close to 10/10"
}
The "fixes" ARE the delivery plan — order them worst-first, each owned, each concrete. 3-6 dissonances, 3-6 fixes. Never discounts, busy effects, or stock clichés.`;

// Create a 'running' review and drive it in the background (rooms + the three
// critics are slow), so the request returns immediately and the UI polls.
async function startReview({ triggeredBy } = {}) {
  if (!visionConfigured()) {
    return ExperienceReview.create({
      scope: 'house', status: 'completed', wowScore: 0, usedVision: false, usedFallback: true, triggeredBy: triggeredBy || '',
      verdict: 'The Atelier has no eyes yet — set GEMINI_API_KEY in Railway to let it see the site.',
      fixes: [{ title: 'Add GEMINI_API_KEY in Railway', where: 'env', how: 'The same Gemini key used for Image Studio gives the Atelier its eyes.', agent: 'founder' }],
    });
  }
  const doc = await ExperienceReview.create({ scope: 'house', status: 'running', triggeredBy: triggeredBy || '' });
  _run(doc._id).catch(err => console.error('[atelier] run failed:', err.message));
  return doc;
}

async function _run(reviewId) {
  const rooms = await resolveRooms();

  // Rooms (vision) + the three craft critics, in parallel where possible.
  const [results, coherence, voice, speed] = await Promise.all([
    (async () => {
      const out = [];
      for (const room of rooms) {
        try { out.push(await reviewRoom(room)); }
        catch (err) { out.push({ name: room.name, path: room.path, score: 0, verdict: `Could not review this room (${err.message.slice(0, 80)}).`, dissonances: [], usedScreenshot: false, loadMs: 0 }); }
      }
      return out;
    })(),
    curate().catch(() => ({ score: 0, summary: 'Coherence check failed.', findings: [] })),
    concierge().catch(() => ({ score: 0, summary: 'Voice check failed.', findings: [] })),
    atmosphere(['/', '/shop', rooms.find(r => r.path.startsWith('/product/'))?.path].filter(Boolean)).catch(() => ({ score: 0, summary: 'Performance check failed.', findings: [] })),
  ]);

  const scored = results.filter(r => r.score > 0);
  const lookAvg = scored.length ? Math.round((scored.reduce((s, r) => s + r.score, 0) / scored.length) * 10) / 10 : 0;
  const weakestRoomObj = scored.length ? scored.reduce((a, b) => (b.score < a.score ? b : a)) : results[0];

  const dimensions = [
    { name: 'Look', score: lookAvg, summary: 'How every rendered room looks — the visual luxury, room by room.', findings: weakestRoomObj ? [`Weakest room: ${weakestRoomObj.name} (${weakestRoomObj.score}/10).`] : [] },
    { name: 'Coherence', score: coherence.score, summary: coherence.summary, findings: coherence.findings },
    { name: 'Voice', score: voice.score, summary: voice.summary, findings: voice.findings },
    { name: 'Speed', score: speed.score, summary: speed.summary, findings: speed.findings },
  ];

  // The Maison Director delivers the verdict + plan.
  let synth = null;
  try {
    const roomsText = results.map(r => `• ${r.name} (${r.path}) — ${r.score}/10. ${r.verdict}${r.dissonances.length ? ' Issues: ' + r.dissonances.map(d => `${d.what} [${d.severity}]`).join('; ') : ''}`).join('\n');
    const pillarsText = dimensions.map(d => `• ${d.name}: ${d.score}/10 — ${d.summary} ${d.findings.join(' ')}`).join('\n');
    const res = await textClient.chat.completions.create({
      model: TEXT_MODEL,
      messages: [{ role: 'system', content: SYNTH_SYSTEM }, { role: 'user', content: `ROOMS:\n${roomsText}\n\nCRAFT PILLARS:\n${pillarsText}\n\nDeliver the verdict + plan JSON now.` }],
      temperature: 0.45, max_tokens: 1300, response_format: { type: 'json_object' },
    }, { timeout: 40000, maxRetries: 1 });
    synth = JSON.parse(res.choices[0]?.message?.content || '{}');
  } catch (err) {
    console.warn('[atelier] synthesis failed, deterministic roll-up:', err.message);
  }

  // Worst-weighted: the house can't score above its weakest pillar/room by much.
  const pillarScores = dimensions.map(d => d.score).filter(n => n > 0);
  const worstPillar = pillarScores.length ? Math.min(...pillarScores) : 0;
  const avgAll = pillarScores.length ? pillarScores.reduce((s, n) => s + n, 0) / pillarScores.length : 0;
  const weighted = pillarScores.length ? Math.round(((avgAll + worstPillar * 2) / 3) * 10) / 10 : 0;

  await ExperienceReview.findByIdAndUpdate(reviewId, {
    status: 'completed',
    dimensions,
    wowScore: synth ? clampScore(synth.wowScore) : weighted,
    weakestRoom: str(synth?.weakestRoom || weakestRoomObj?.name || '', 160),
    verdict: str(synth?.verdict || `Walked ${results.length} rooms across 4 pillars; weakest pillar ${worstPillar}/10.`, 400),
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
  }).catch(err => console.error('[atelier] save failed:', err.message));
}

module.exports = { startReview, visionConfigured };
