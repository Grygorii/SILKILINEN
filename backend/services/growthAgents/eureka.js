'use strict';

// The Inventor — the Eureka engine. The other agents observe, decide and
// execute; this one INVENTS. Once a week it studies the whole competitive
// field, the brand's own catalogue, and what SILKILINEN already has, and it
// CONNECTS THE DOTS: it combines two or more proven patterns into a brand-new
// tool the shop could own that no rival has built — the way a quiz is FAQ +
// game. Pure synthesis: it needs no eyes on a blocked site, only information
// and the move of combination. Each idea is a "Tell Claude to build this".

const Product = require('../../models/Product');
const Category = require('../../models/Category');
const GrowthAction = require('../../models/GrowthAction');
const { getCompetitors } = require('../competitorIntel');
const CompetitorProfile = require('../../models/CompetitorProfile');
const SystemState = require('../../models/SystemState');
const { serpConfigured, serpAnalysis } = require('../seoIntel');
const { fetchReadablePage } = require('../externalData');

const client = require('../aiClient'); // shared DeepSeek client
const { playbookPromptBlock } = require('../playbook'); // house memory (Archivarius)
const MODEL = process.env.DEEPSEEK_MODEL_ANALYST || 'deepseek-chat';

// What SILKILINEN ALREADY has — so the Inventor builds new ground, never
// re-suggests what exists. Kept current as the shop grows.
const EXISTING = [
  'Silk Style Finder quiz (with shareable personas)',
  'product bundles', 'Drop-a-Hint gifting', 'gift wrapping', 'free shipping over €150',
  'customer reviews + Google Customer Reviews stars', 'abandoned-cart email recovery',
  'wishlist', 'AI Image Studio', 'a journal/blog', 'newsletter capture',
  'an autonomous Growth Engine (content, social, demand, competitor scouts; a co-CEO brief)',
];

// The lenses through which the Inventor STUDIES THE WORLD — deliberately
// cross-domain, because the best eureka moves take a mechanic proven somewhere
// else (another industry, a new technology, a viral format) and bring it where
// it hasn't been. Rotated so each run studies a different slice of the world.
const WORLD_LENSES = [
  'innovative interactive features ecommerce brands launched recently',
  'direct to consumer marketing ideas going viral',
  'luxury brands immersive online experience trends',
  'how AI personalisation is changing online shopping',
  'sleep and wellness brands creative customer engagement ideas',
  'tasteful gamification examples in premium online retail',
  'fashion brands user generated content campaigns that worked',
  'interactive quiz and tool ideas that grow email lists',
  'augmented reality and 3D shopping experiences in fashion',
  'community and membership ideas for premium lifestyle brands',
];
const WORLD_CURSOR_KEY = 'eurekaWorldCursor';

// Go and read what's genuinely new in the world right now: run a few rotated
// web searches and skim the best results, so the Inventor invents from FRESH
// real-world signal — not only patterns it already knew. Free (Google CSE, 100/
// day); fails soft to empty when web search isn't configured.
async function studyTheWorld() {
  if (!serpConfigured()) return { configured: false, findings: [], pages: [] };
  const doc = await SystemState.findOne({ key: WORLD_CURSOR_KEY }).lean().catch(() => null);
  const cursor = Number(doc?.value) || 0;
  const picked = [0, 1, 2].map(i => WORLD_LENSES[(cursor + i) % WORLD_LENSES.length]);
  await SystemState.findOneAndUpdate({ key: WORLD_CURSOR_KEY }, { value: (cursor + 3) % WORLD_LENSES.length }, { upsert: true }).catch(() => {});

  const searches = await Promise.all(picked.map(q => serpAnalysis(q, 'us').catch(() => null)));
  const findings = [];
  const topLinks = [];
  searches.forEach((r, i) => {
    if (r && r.results && r.results.length) {
      findings.push({ lens: picked[i], hits: r.results.slice(0, 4).map(x => `${x.title} — ${x.snippet}`.slice(0, 200)) });
      if (r.results[0].link) topLinks.push(r.results[0].link);
    }
  });
  // Read one or two of the most promising pages for richer raw material.
  const pages = [];
  for (const link of topLinks.slice(0, 2)) {
    const text = await fetchReadablePage(link, 1400).catch(() => '');
    if (text && text.length > 200) pages.push(`From ${link}:\n${text.slice(0, 1100)}`);
  }
  return { configured: true, findings, pages };
}

async function gatherContext() {
  const [cats, priceAgg, competitors, intel, profiles] = await Promise.all([
    Category.find({ status: 'active' }).select('label').lean().catch(() => []),
    Product.aggregate([
      { $match: { status: { $in: ['active', 'sold_out'] } } },
      { $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' }, n: { $sum: 1 } } },
    ]).catch(() => []),
    getCompetitors(),
    GrowthAction.find({ agent: { $in: ['competitor', 'storefront', 'demand'] } })
      .sort({ createdAt: -1 }).limit(8).select('title detail').lean().catch(() => []),
    CompetitorProfile.find().select('productTypes priceMin priceMax').lean().catch(() => []),
  ]);
  const p = priceAgg[0] || {};

  // What the field ACTUALLY sells — aggregated from the scraped competitor
  // profiles, so the Inventor finds real white space, not gaps it imagines.
  const typeCounts = {};
  for (const pr of profiles) for (const t of (pr.productTypes || [])) {
    const k = String(t).trim().toLowerCase();
    if (k) typeCounts[k] = (typeCounts[k] || 0) + 1;
  }
  const fieldTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([t, n]) => `${t} (${n})`);
  const mins = profiles.map(pr => pr.priceMin).filter(n => n > 0);
  const maxs = profiles.map(pr => pr.priceMax).filter(n => n > 0);
  const fieldPrices = mins.length ? `~${Math.round(Math.min(...mins))}–${Math.round(Math.max(...maxs))} (across ${profiles.length} scraped stores, mixed currencies)` : '';

  return {
    categories: cats.map(c => c.label),
    priceRange: p.min != null ? `€${Math.round(p.min)}–€${Math.round(p.max)} (${p.n} products)` : 'unknown',
    competitors: competitors.slice(0, 40).map(c => c.name),
    intel: intel.map(a => `${a.title} — ${(a.detail || '').slice(0, 160)}`),
    fieldTypes,
    fieldPrices,
  };
}

const SYSTEM = `You are the Inventor for SILKILINEN, a quiet-luxury silk & linen brand. Your job is the EUREKA move: STUDY what is genuinely new and interesting in the world right now — across other industries, new technology, viral formats — then make the leap, "we could apply THAT to a quiet-luxury silk house, the way no one has." The best inventions take a mechanic proven SOMEWHERE ELSE and bring it where it hasn't been (a quiz is "FAQ + game"; a virtual try-on is "catalogue + camera").

You are given FRESH SIGNALS studied from the live web this week: what brands, technology and adjacent industries are actually doing right now. Do NOT just recombine ideas you already knew — start from a SPECIFIC interesting thing in those signals and apply it to silk.

Rules:
- Ground each idea in a SPECIFIC real-world signal you were shown — name what you saw and what you'd apply ("seen in the wild: X → applied to silk: Y"). If the signals are thin this run, say so and reason from knowledge, but always prefer the fresh signal.
- It must fit a QUIET-LUXURY silk brand — elegant, considered, never gimmicky, never a discount/casino mechanic, never a price-comparison move.
- It must be NEW for this shop — do not suggest anything in the "already has" list.
- It must plausibly DRIVE SALES or capture/keep an audience, and be buildable by a developer on a Next.js + Node store.

Respond ONLY with valid JSON:
{ "ideas": [ { "name": "the tool's name", "formula": "real-world pattern → silk application", "what": "1-2 sentences on what it is", "whySells": "the commercial reason", "edge": "why it's an edge — what the field is missing", "inspiration": "the specific real-world signal that sparked it (what you saw in the world)", "claudeCanBuild": true } ] }
Give 2-3 ideas, the boldest-yet-buildable first.`;

async function run() {
  if (!process.env.DEEPSEEK_API_KEY) {
    return [{ type: 'info', title: 'Skipped — AI not configured', status: 'info' }];
  }
  const [ctx, world] = await Promise.all([gatherContext(), studyTheWorld()]);

  const user = [
    `SILKILINEN — quiet-luxury silk & linen.`,
    `Catalogue: ${ctx.categories.join(', ') || 'silk pieces'}; prices ${ctx.priceRange}.`,
    `Already has (do NOT re-suggest): ${EXISTING.join('; ')}.`,
    `Competitive field (${ctx.competitors.length} brands): ${ctx.competitors.join(', ') || 'luxury silk & sleepwear brands'}.`,
    ctx.fieldTypes.length ? `What the field ACTUALLY sells (scraped from rival stores — product type, most common first; the white space is what's ABSENT here): ${ctx.fieldTypes.join(', ')}.` : '',
    ctx.fieldPrices ? `Field price spread: ${ctx.fieldPrices}.` : '',
    ctx.intel.length ? `Recent market intel:\n- ${ctx.intel.join('\n- ')}` : '',
    ``,
    `── WHAT THE WORLD IS DOING (studied fresh from the live web this week) ──`,
    world.configured && world.findings.length
      ? world.findings.map(f => `WORLD LENS — ${f.lens}:\n${f.hits.map(h => `  • ${h}`).join('\n')}`).join('\n')
      : '(No fresh world study this run — web search isn\'t configured. Reason from what you know, and lean hard toward genuinely novel, cross-industry applications rather than the usual DTC playbook.)',
    world.pages.length ? `\nDEEPER READS:\n${world.pages.join('\n\n')}` : '',
    ``,
    `Now make the EUREKA leap: take a SPECIFIC interesting thing from the world above and apply it to a quiet-luxury silk house in a way no rival has. Name the real-world spark for each idea. Return the JSON.`,
  ].filter(Boolean).join('\n');

  let parsed = null;
  try {
    const res = await client.chat.completions.create(
      { model: MODEL, messages: [{ role: 'system', content: SYSTEM + await playbookPromptBlock().catch(() => '') }, { role: 'user', content: user }], temperature: 0.8, max_tokens: 1000, response_format: { type: 'json_object' } },
      { timeout: 40000, maxRetries: 1 },
    );
    parsed = JSON.parse(res.choices[0]?.message?.content || '{}');
  } catch (err) {
    console.warn('[eureka] synthesis failed:', err.message);
    return [{ type: 'info', title: 'The Inventor couldn\'t reach the AI this run — will try next cycle', status: 'info' }];
  }

  const ideas = Array.isArray(parsed.ideas) ? parsed.ideas.slice(0, 3) : [];
  if (!ideas.length) {
    return [{ type: 'info', title: 'No new invention this run — the field is well covered', status: 'info' }];
  }

  return ideas.map(i => ({
    type: 'eureka',
    title: `Eureka: ${i.name}`,
    detail: `${i.formula ? `${i.formula} — ` : ''}${i.what || ''} ${i.whySells ? `· ${i.whySells}` : ''}${i.edge ? ` · Edge: ${i.edge}` : ''}${i.inspiration ? ` · Seen in the world: ${i.inspiration}` : ''}${i.claudeCanBuild ? ' · Tell Claude to build this.' : ''}`,
    href: '/admin/growth',
    status: 'needs_approval',
    meta: { name: i.name, formula: i.formula, what: i.what, whySells: i.whySells, edge: i.edge, inspiration: i.inspiration || '' },
  }));
}

module.exports = {
  name: 'eureka',
  label: 'The Inventor',
  description: 'Combines proven patterns into brand-new tools SILKILINEN could own — the Eureka move (like quiz = FAQ + game). Each idea is a "tell Claude to build this".',
  cadenceHours: 168,
  defaultEnabled: true,
  run,
};
