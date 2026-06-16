'use strict';

// Demand Scout — the radar that watches the OUTSIDE world. It reads real
// public search demand from Google (autocomplete = what people actually type;
// Trends = whether interest is rising), cross-references the founder's own
// Search Console position, and surfaces the waves worth riding: phrases with
// real demand the shop doesn't yet own. This is the wife's-Etsy story turned
// into a sensor — see the wave before the sales move, not after.
//
// Runs on Railway (open internet). In the build sandbox the external calls are
// blocked; the parsing is unit-tested separately. Every source fails soft.

const Product = require('../../models/Product');
const Category = require('../../models/Category');
const SystemState = require('../../models/SystemState');
const { expandDemand, googleTrendsInterest } = require('../externalData');
const { playbookPromptBlock } = require('../playbook');

const client = require('../aiClient'); // shared DeepSeek client
const MODEL = process.env.DEEPSEEK_MODEL_ANALYST || 'deepseek-chat';
const CURSOR_KEY = 'demandScoutCursor';

// Build search seeds from the real catalogue so the radar watches the founder's
// actual market. Category labels and product nouns, normalised to "silk X".
async function buildSeeds() {
  const [cats, products] = await Promise.all([
    Category.find({ status: 'active' }).select('label slug').lean().catch(() => []),
    Product.find({ status: 'active' }).select('name category').limit(40).lean(),
  ]);
  const seeds = new Set();
  for (const c of cats) {
    const base = String(c.label || c.slug).toLowerCase().replace(/s$/, '');
    if (base) seeds.add(/silk|linen/.test(base) ? base : `silk ${base}`);
  }
  // Common silk-category anchors, included so a thin catalogue still has demand
  // terms to watch.
  ['silk pillowcase', 'silk pyjamas', 'silk robe', 'silk scarf', 'silk eye mask', 'silk slip dress', 'silk bonnet']
    .forEach(s => seeds.add(s));
  if (!products.length && seeds.size === 0) return [];
  return [...seeds].slice(0, 12);
}

async function getCursor() {
  const doc = await SystemState.findOne({ key: CURSOR_KEY }).lean();
  return Number(doc?.value) || 0;
}
async function setCursor(n) {
  await SystemState.findOneAndUpdate({ key: CURSOR_KEY }, { value: n }, { upsert: true });
}

// Search Console queries the site already appears for — to spot the GAP
// (high external demand, weak/zero presence).
async function ownQueries() {
  try {
    const gsc = require('../searchConsole');
    if (!(await gsc.isConnected())) return null;
    const opps = await gsc.getQueryOpportunities(28);
    return opps; // [{ query, impressions, position }]
  } catch {
    return null;
  }
}

async function run() {
  if (!process.env.DEEPSEEK_API_KEY) {
    return [{ type: 'info', title: 'Skipped — AI not configured', status: 'info' }];
  }

  const seeds = await buildSeeds();
  if (!seeds.length) {
    return [{ type: 'info', title: 'No demand seeds — add categories or products to watch', status: 'info' }];
  }

  // Rotate through the seed list across runs so the whole market gets covered
  // without hammering Google in one go. Two seeds per run.
  const cursor = await getCursor();
  const picked = [seeds[cursor % seeds.length], seeds[(cursor + 1) % seeds.length]];
  await setCursor((cursor + 2) % seeds.length);

  // Gather real external demand for the picked seeds.
  const demand = [];
  for (const seed of picked) {
    const [phrases, trend] = await Promise.all([
      expandDemand(seed, 'IE'),
      googleTrendsInterest(seed, 'IE'),
    ]);
    demand.push({ seed, phrases, trend });
  }

  const totalPhrases = demand.reduce((n, d) => n + d.phrases.length, 0);
  if (totalPhrases === 0) {
    // External sources unreachable this run (sandbox, or Google rate-limit).
    return [{
      type: 'info',
      title: `Demand radar reached no external data this run (seeds: ${picked.join(', ')})`,
      detail: 'Google did not return suggestions this cycle — likely a temporary rate-limit. The radar will retry next pulse.',
      status: 'info',
    }];
  }

  const own = await ownQueries();
  const ownMap = own ? new Map(own.map(o => [o.query.toLowerCase(), o])) : null;

  // Annotate each demand phrase with the founder's current standing.
  const annotated = demand.map(d => ({
    seed: d.seed,
    trend: d.trend,
    phrases: d.phrases.map(p => {
      const mine = ownMap ? ownMap.get(p.toLowerCase()) : null;
      return mine ? `${p} [you: pos ${mine.position}, ${mine.impressions} imp]` : `${p} [you: not ranking]`;
    }).slice(0, 25),
  }));

  const playbook = await playbookPromptBlock();
  const system = `You are the demand analyst for SILKILINEN, a luxury silk & linen brand (EUR). You are given REAL Google search demand: autocomplete phrases people actually type around seed terms, an optional rising/falling Trends read, and — where known — the brand's own Google position for a phrase. Find the WAVES worth riding: phrases with clear public demand and intent that the shop doesn't yet own (not ranking, or weak position), favouring any marked rising.

Be concrete and commercial. British/Irish English. Never claim products are handmade or made in Ireland.${playbook}

Respond ONLY with valid JSON:
{
  "opportunities": [
    { "phrase": "the exact search phrase", "demand": "why it matters (intent, rising?)", "gap": "the brand's current standing", "moves": ["1-3 concrete moves: an article angle, a product to push, a social/Pinterest idea"] }
  ]
}
2-4 opportunities, the strongest first. Use only the phrases provided.`;

  const userPayload = annotated.map(a => {
    const trendLine = a.trend
      ? `Trends for "${a.seed}": ${a.trend.direction}${a.trend.changePct != null ? ` (${a.trend.changePct > 0 ? '+' : ''}${a.trend.changePct}% vs earlier)` : ''}, recent interest ${a.trend.recentInterest}/100.`
      : `Trends for "${a.seed}": not available this run.`;
    return `SEED "${a.seed}":\n${trendLine}\nReal autocomplete demand:\n${a.phrases.map(p => `- ${p}`).join('\n')}`;
  }).join('\n\n');

  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'system', content: system }, { role: 'user', content: userPayload }],
    temperature: 0.4,
    max_tokens: 900,
    response_format: { type: 'json_object' },
  });

  let parsed;
  try { parsed = JSON.parse(res.choices[0]?.message?.content || '{}'); }
  catch { throw new Error('Demand synthesis returned invalid JSON'); }

  const opps = Array.isArray(parsed.opportunities) ? parsed.opportunities.slice(0, 4) : [];
  if (!opps.length) {
    return [{ type: 'info', title: `Scanned demand for ${picked.join(', ')} — no clear gap to act on this run`, status: 'info' }];
  }

  return opps.map(o => ({
    type: 'demand_signal',
    title: `Demand wave: "${o.phrase}"`,
    detail: `${o.demand} ${o.gap ? `· ${o.gap}` : ''} → ${(o.moves || []).join(' · ')}`,
    href: '/admin/growth',
    status: 'needs_approval',
    meta: { phrase: o.phrase, moves: o.moves || [], seeds: picked },
  }));
}

module.exports = {
  name: 'demand',
  label: 'Demand Scout',
  description: 'Watches real Google search demand around your market (autocomplete + Trends), cross-checks your own ranking, and surfaces the rising waves you don\'t yet own — the outside-world signal that drives traffic.',
  cadenceHours: 48,
  defaultEnabled: true,
  run,
};
