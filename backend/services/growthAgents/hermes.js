'use strict';

// Hermes · the Pathfinder — the studio's search-performance strategist. Hermes
// is the Greek god of roads, travel and trade; Google Search Console is the map
// of the roads people actually take to reach the shop, and his job is to widen
// the ones already working and pave the ones that almost work. He reads the real
// GSC data — which queries the shop ranks for, at what position, with what CTR,
// and which pages earn the impressions — and turns it into a SHORT, RANKED plan
// of concrete moves to win more clicks from the footholds Google already grants.
//
// He looks INWARD (terms the shop already ranks for) where the Demand Scout
// looks OUTWARD (new terms the world searches) — no overlap. Calibrated for an
// early-stage site: with only a handful of impressions he says so honestly and
// names the one or two real footholds rather than inventing a grand plan. He
// gets sharper every week as the data grows, and teaches the Playbook what's
// actually ranking so the Content Writer biases toward it.
//
// Needs GSC connected (runs on Railway). Fails soft on every gather.

const OpenAI = require('openai');
const Product = require('../../models/Product');
const { isConnected, getSearchPerformance, getQueryOpportunities } = require('../searchConsole');
const { addLearning, playbookPromptBlock } = require('../playbook');

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || 'not-set',
  baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
});
const MODEL = process.env.DEEPSEEK_MODEL_ANALYST || 'deepseek-chat';

async function gatherContext() {
  const [perf, opps, products] = await Promise.all([
    getSearchPerformance(28).catch(() => null),
    getQueryOpportunities(28).catch(() => []),
    Product.find({ status: 'active' }).select('name category metaTitle metaDescription').lean().catch(() => []),
  ]);
  const missingMeta = products
    .filter(p => !p.metaTitle || !p.metaDescription)
    .map(p => p.name);
  return { perf, opps: (opps || []).slice(0, 15), products, missingMeta };
}

const SYSTEM = `You are Hermes, the search-performance strategist for SILKILINEN — a quiet-luxury silk & linen house. You read the shop's REAL Google Search Console data and turn it into a short, ranked plan to win more clicks from the search footholds Google already grants. You never invent numbers; you reason only over the figures handed to you.

How you think, in priority order:
1. STRIKING DISTANCE (highest leverage): queries the shop ranks for at roughly position 8-20 with real impressions. A small, honest improvement to the matching page — a sharper title/H1, one more paragraph of genuine detail, an internal link, alt-text — can push it onto page one, where the clicks are. Name the query, its position, and the exact page (usually a specific product or category) to improve.
2. SEEN BUT NOT CLICKED: a page with impressions but no clicks usually has a weak meta title/description for that intent. Recommend rewriting it to earn the click (quiet-luxury voice, never salesy).
3. NEAR-MISS: position 4-10 — a nudge to reach the top three.
4. META GAPS: if a query maps to a product with no meta title/description, that page is competing with one hand tied — flag it to generate SEO.

Hard rules:
- QUIET LUXURY: never recommend price/discount/"cheaper than" moves, never clickbait. Aspire upward through specificity and fabric/craft detail.
- NEVER claim or imply where a product is made (no "made in Ireland/Donegal"); origin varies and isn't given.
- British/Irish English.
- BE HONEST ABOUT SCALE: you will be told the impression total. If it is small (an early-stage site), say so plainly, give the one or two REAL footholds worth acting on, and do not manufacture a big plan from thin data. A truthful "too early, here are the 1-2 real footholds, keep publishing" is the right answer when the data is thin.

Respond ONLY with valid JSON:
{
  "state": "thin" | "actionable",
  "read": "one honest sentence on the search picture right now",
  "plays": [ { "target": "the query or page", "page": "the exact page to improve (product/category/path)", "position": number|null, "impressions": number|null, "issue": "what's holding the clicks back", "action": "the one concrete thing to do, phrased as an instruction", "leverage": "high" | "low" } ],
  "lesson": "OPTIONAL: one short, durable rule for the other agents about what is ranking and what to lean into (e.g. 'Pillowcase colour-name queries are our fastest-ranking foothold — keep colour in titles'). Omit if nothing durable yet."
}
Give at most 5 plays, highest leverage first.`;

async function run() {
  if (!process.env.DEEPSEEK_API_KEY) {
    return [{ type: 'info', title: 'Skipped — AI not configured', status: 'info' }];
  }
  if (!(await isConnected().catch(() => false))) {
    return [{
      type: 'info',
      title: 'Hermes is waiting on Search Console',
      detail: 'Connect Google Search Console (Dashboard → Search performance → Connect) and Hermes will start mapping the searches people already use to find you, and how to win more clicks from them.',
      href: '/admin',
      status: 'info',
    }];
  }

  const { perf, opps, products, missingMeta } = await gatherContext();
  const impressions = perf?.totals?.impressions || 0;
  if (!perf || impressions === 0) {
    return [{
      type: 'info',
      title: 'No search footholds yet — Hermes is watching',
      detail: 'Google isn\'t showing the shop for any searches yet. The work now is publishing and demand-building; the moment real impressions appear, Hermes will map them into a plan to win clicks.',
      href: '/admin/growth',
      status: 'info',
    }];
  }

  const learned = await playbookPromptBlock().catch(() => '');
  const user = [
    `SEARCH PICTURE (last 28 days, finalised): ${perf.totals.clicks} clicks, ${impressions} impressions, avg position ${Math.round(perf.totals.position)}. This is an early-stage site — calibrate honestly to this scale.`,
    ``,
    `QUERIES THE SHOP RANKS FOR (position, impressions — the raw material for striking-distance and near-miss plays):`,
    opps.length ? opps.map(o => `- "${o.query}" — position ${o.position}, ${o.impressions} imp, ${o.clicks} clk`).join('\n') : '- none surfaced yet',
    ``,
    `TOP PAGES (where impressions/clicks land — read these for "seen but not clicked"):`,
    (perf.topPages || []).length ? perf.topPages.map(p => `- ${p.key.replace(/^https?:\/\/[^/]+/, '') || '/'} — ${p.impressions} imp, ${p.clicks} clk`).join('\n') : '- none yet',
    ``,
    `CATALOGUE (active products you can map queries onto): ${products.map(p => p.name).slice(0, 30).join(', ') || 'none'}.`,
    missingMeta.length ? `PRODUCTS MISSING META (a query that maps to one of these is competing with one hand tied — flag to generate SEO): ${missingMeta.slice(0, 12).join(', ')}.` : 'All active products have meta titles/descriptions.',
    learned,
    ``,
    `Read the picture and return the ranked plan as JSON.`,
  ].join('\n');

  let parsed = null;
  try {
    const res = await client.chat.completions.create(
      { model: MODEL, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }], temperature: 0.4, max_tokens: 1100, response_format: { type: 'json_object' } },
      { timeout: 45000, maxRetries: 1 },
    );
    parsed = JSON.parse(res.choices[0]?.message?.content || '{}');
  } catch (err) {
    console.warn('[hermes] analysis failed:', err.message);
    return [{ type: 'info', title: 'Hermes couldn\'t reach the AI this run — will map again next cycle', status: 'info' }];
  }

  const plays = (Array.isArray(parsed.plays) ? parsed.plays : []).filter(p => p && (p.target || p.page)).slice(0, 5);

  // Teach the Playbook what's ranking, so the Content Writer leans into it.
  if (parsed.lesson) await addLearning(String(parsed.lesson)).catch(() => {});

  if (!plays.length) {
    return [{
      type: 'seo',
      title: `Hermes: ${parsed.read ? String(parsed.read).slice(0, 90) : 'search read logged, no action this run'}`,
      detail: `${parsed.read || ''} Too few signals to act on yet — keep publishing and Hermes will map footholds as they appear.`,
      href: '/admin/growth',
      status: 'info',
      meta: { state: parsed.state || 'thin', impressions },
    }];
  }

  return plays.map(p => {
    const high = String(p.leverage).toLowerCase() === 'high';
    const pos = p.position != null ? ` (pos ${p.position}${p.impressions != null ? `, ${p.impressions} imp` : ''})` : '';
    return {
      type: 'seo',
      title: `Hermes: ${String(p.target || p.page).slice(0, 80)}`,
      detail: `${p.issue || ''}${pos}${p.page ? ` · Page: ${p.page}` : ''} · Do this: ${p.action || 'improve this page for the query'}`,
      href: '/admin/products',
      status: high ? 'needs_approval' : 'info',
      meta: { target: p.target || '', page: p.page || '', position: p.position ?? null, impressions: p.impressions ?? null, leverage: high ? 'high' : 'low' },
    };
  });
}

module.exports = {
  name: 'hermes',
  label: 'Hermes · Pathfinder',
  description: 'Reads your real Search Console data and turns it into a ranked plan to win more clicks — striking-distance queries to push onto page one, pages seen but not clicked, and meta gaps. Looks inward (what you already rank for) where the Demand Scout looks outward.',
  cadenceHours: 72,
  defaultEnabled: true,
  run,
};
