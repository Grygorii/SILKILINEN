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

async function gatherContext() {
  const [cats, priceAgg, competitors, intel] = await Promise.all([
    Category.find({ status: 'active' }).select('label').lean().catch(() => []),
    Product.aggregate([
      { $match: { status: { $in: ['active', 'sold_out'] } } },
      { $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' }, n: { $sum: 1 } } },
    ]).catch(() => []),
    getCompetitors(),
    GrowthAction.find({ agent: { $in: ['competitor', 'storefront', 'demand'] } })
      .sort({ createdAt: -1 }).limit(8).select('title detail').lean().catch(() => []),
  ]);
  const p = priceAgg[0] || {};
  return {
    categories: cats.map(c => c.label),
    priceRange: p.min != null ? `€${Math.round(p.min)}–€${Math.round(p.max)} (${p.n} products)` : 'unknown',
    competitors: competitors.slice(0, 40).map(c => c.name),
    intel: intel.map(a => `${a.title} — ${(a.detail || '').slice(0, 160)}`),
  };
}

const SYSTEM = `You are the Inventor for SILKILINEN, a quiet-luxury silk & linen brand. Your single job is the EUREKA move: take proven patterns and COMBINE them into a brand-new tool or experience the shop could build that no competitor has. Think like the person who realised a quiz is "FAQ + game", a waitlist is "scarcity + email", a virtual try-on is "catalogue + camera".

Rules:
- Each idea must be a genuine COMBINATION of 2+ existing ideas, named as a formula (e.g. "Care guide + AR mirror", "Gifting + horoscope", "Journal + shoppable film").
- It must fit a QUIET-LUXURY silk brand — elegant, considered, never gimmicky, never a discount/casino mechanic, never a price-comparison move.
- It must be NEW for this shop — do not suggest anything in the "already has" list.
- It must plausibly DRIVE SALES or capture/keep an audience, and be buildable by a developer on a Next.js + Node store.
- Prefer ideas the wider field hints at but no silk brand has nailed.

Respond ONLY with valid JSON:
{ "ideas": [ { "name": "the tool's name", "formula": "A + B (the combination)", "what": "1-2 sentences on what it is", "whySells": "the commercial reason", "edge": "why it's an edge — what the field is missing", "claudeCanBuild": true } ] }
Give 2-3 ideas, the boldest-yet-buildable first.`;

async function run() {
  if (!process.env.DEEPSEEK_API_KEY) {
    return [{ type: 'info', title: 'Skipped — AI not configured', status: 'info' }];
  }
  const ctx = await gatherContext();

  const user = [
    `SILKILINEN — quiet-luxury silk & linen.`,
    `Catalogue: ${ctx.categories.join(', ') || 'silk pieces'}; prices ${ctx.priceRange}.`,
    `Already has (do NOT re-suggest): ${EXISTING.join('; ')}.`,
    `Competitive field (${ctx.competitors.length} brands): ${ctx.competitors.join(', ') || 'luxury silk & sleepwear brands'}.`,
    ctx.intel.length ? `Recent market intel:\n- ${ctx.intel.join('\n- ')}` : 'No fresh intel this week — invent from first principles.',
    ``,
    `Now CONNECT THE DOTS. Combine proven patterns into new tools SILKILINEN could own. Return the JSON.`,
  ].join('\n');

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
    detail: `${i.formula ? `${i.formula} — ` : ''}${i.what || ''} ${i.whySells ? `· ${i.whySells}` : ''}${i.edge ? ` · Edge: ${i.edge}` : ''}${i.claudeCanBuild ? ' · Tell Claude to build this.' : ''}`,
    href: '/admin/growth',
    status: 'needs_approval',
    meta: { name: i.name, formula: i.formula, what: i.what, whySells: i.whySells, edge: i.edge },
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
