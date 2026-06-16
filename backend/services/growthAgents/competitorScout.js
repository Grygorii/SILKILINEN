'use strict';

// Competitor Scout — studies one named competitor per run against SILKILINEN's
// real catalogue and reports back what to actually DO. Rotates through the
// founder's competitor list so the whole field gets covered over time; press
// Run repeatedly to march through them faster. Grounded in the model's deep
// knowledge of the silk/sleepwear market, enriched (best-effort) with the
// competitor's current live products.

const Product = require('../../models/Product');
const SystemState = require('../../models/SystemState');
const { getCompetitors, liveProductSample } = require('../competitorIntel');

const client = require('../aiClient'); // shared DeepSeek client
const MODEL = process.env.DEEPSEEK_MODEL_ANALYST || 'deepseek-chat';
const ROTATE_KEY = 'growthCompetitorRotation';

async function catalogSummary() {
  const products = await Product.find({ status: { $in: ['active', 'sold_out'] } })
    .select('name category price').lean();
  if (!products.length) return null;
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
  const prices = products.map(p => p.price).filter(n => n > 0);
  return {
    count: products.length,
    categories,
    priceMinEUR: prices.length ? Math.min(...prices) : null,
    priceMaxEUR: prices.length ? Math.max(...prices) : null,
    sample: products.slice(0, 14).map(p => p.name),
  };
}

const SYSTEM = `You are a world-class DTC competitive strategist for luxury fashion e-commerce. SILKILINEN is a small Irish brand based in Donegal selling mulberry silk AND European linen — intimates, sleepwear, robes, slip dresses and pillowcases — at accessible-luxury prices. You know the silk/sleepwear competitive landscape intimately (Olivia von Halle, Lunya, Eberjey, Slip, Quince, LilySilk and peers).

Analyse ONE named competitor against SILKILINEN's real catalogue. Be specific and honest: name real tactics, real price points, real product types and real positioning — no vague filler. Then find the GAP SILKILINEN can genuinely own. Strong angles to consider: SILKILINEN does LINEN (most silk competitors don't); it sits below the £300–600 "investment set" tier; it has a real Irish/Donegal brand story; it is small enough to be personal. Every recommended move must be executable by a tiny team in days, not a campaign.

RESPOND ONLY WITH VALID JSON (no markdown, no code fences):
{
 "positioning": "one sentence on how this competitor positions itself",
 "priceArchitecture": "their price range and what it signals",
 "signatureMove": "the single thing they win on",
 "weakness": "where they are exposed or what they simply don't do",
 "yourOpening": "the specific lane SILKILINEN can own against them, tied to its real products",
 "moves": [
   {"action": "a concrete thing to do this week", "why": "why it works against this competitor", "effort": "low|medium"}
 ]
}
Give 3 moves.`;

async function analyse(competitor, catalog, liveSample) {
  const userParts = [
    `COMPETITOR: ${competitor.name}${competitor.domain ? ` (${competitor.domain})` : ''}`,
    liveSample && liveSample.length
      ? `Their current live products (sampled from their site today): ${liveSample.join('; ')}`
      : `(Live product sample unavailable — use your own knowledge of this brand.)`,
    ``,
    `SILKILINEN's real catalogue:`,
    `- ${catalog.count} products across: ${catalog.categories.join(', ') || 'uncategorised'}`,
    catalog.priceMinEUR != null ? `- Price range: €${catalog.priceMinEUR}–€${catalog.priceMaxEUR}` : '',
    `- Example products: ${catalog.sample.join('; ')}`,
    ``,
    `Return the JSON analysis now.`,
  ].filter(Boolean);

  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: userParts.join('\n') },
    ],
    temperature: 0.5,
    max_tokens: 900,
    response_format: { type: 'json_object' },
  });
  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error('Empty response from AI provider');
  const parsed = JSON.parse(content);
  if (!parsed.positioning || !parsed.yourOpening || !Array.isArray(parsed.moves)) {
    throw new Error('Competitor analysis returned an invalid shape');
  }
  return parsed;
}

async function run() {
  if (!process.env.DEEPSEEK_API_KEY) {
    return [{ type: 'info', title: 'Skipped — AI not configured', status: 'info' }];
  }

  const competitors = await getCompetitors();
  if (!competitors.length) {
    return [{ type: 'info', title: 'No competitors set — add some in Growth Engine', status: 'info' }];
  }

  const catalog = await catalogSummary();
  if (!catalog) {
    return [{ type: 'info', title: 'Add active products before scouting competitors', status: 'info' }];
  }

  // Rotate to the next competitor each run.
  const rotDoc = await SystemState.findOne({ key: ROTATE_KEY }).lean();
  const idx = (rotDoc && Number.isInteger(rotDoc.value) ? rotDoc.value : 0) % competitors.length;
  const competitor = competitors[idx];
  await SystemState.findOneAndUpdate({ key: ROTATE_KEY }, { value: (idx + 1) % competitors.length }, { upsert: true });

  const liveSample = await liveProductSample(competitor.domain);
  const a = await analyse(competitor, catalog, liveSample);

  const liveTag = liveSample && liveSample.length ? 'live products read' : 'from market knowledge';
  const moveLines = a.moves.slice(0, 3).map((m, i) => `${i + 1}. ${m.action} (${m.effort || 'effort n/a'})`).join('  ');

  return [
    {
      type: 'competitor_intel',
      title: `Competitor teardown: ${competitor.name}`,
      detail: `${a.positioning} · Price: ${a.priceArchitecture} · Wins on: ${a.signatureMove} · Exposed: ${a.weakness}. [${liveTag}]`,
      href: competitor.domain ? `https://${competitor.domain}` : '',
      status: 'info',
      meta: { competitor: competitor.name, analysis: a },
    },
    {
      type: 'competitor_intel',
      title: `Your opening vs ${competitor.name}`,
      detail: `${a.yourOpening} → Moves: ${moveLines}`,
      href: '/admin/products',
      status: 'needs_approval',
      meta: { competitor: competitor.name, moves: a.moves },
    },
  ];
}

module.exports = {
  name: 'competitor',
  label: 'Competitor Scout',
  description: 'Studies one competitor per run (Olivia von Halle, Lunya, Eberjey…) against your real catalogue and reports the gap you can own and the moves to make. Press Run to march through your list.',
  cadenceHours: 96,
  defaultEnabled: true,
  run,
};
