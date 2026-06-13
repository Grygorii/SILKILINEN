'use strict';

// Da Vinci — the conductor. Where the Chief of Staff writes a weekly memo,
// Da Vinci composes a masterwork: unleashed on demand, he surveys everything
// every agent has already produced — demand waves, inventions, scout intel,
// drafts, the brief, the AI Star — and weaves it into ONE bold 90-day symphony
// that points the whole studio at the goal.
//
// Efficient by design (the founder's own insight): he does NOT re-run a million
// tokens of work. The full orchestra is fired ONCE in the background (so fresh
// notes arrive for next time) while Da Vinci composes from the rich output
// already on the desk — two AI calls, not fifteen. Safe by construction: he
// commands only the existing draft-only agents; nothing publishes, nothing
// spends, every concrete output still waits for the founder's approval.

const OpenAI = require('openai');
const DaVinciComposition = require('../models/DaVinciComposition');
const CEOBrief = require('../models/CEOBrief');
const GrowthAction = require('../models/GrowthAction');
const { generateBrief, northStarStatus } = require('./chiefOfStaff');
const { runGrowthEngine } = require('./growthEngine');
const { getCompetitors } = require('./competitorIntel');
const { getPlaybook } = require('./playbook');

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || 'not-set',
  baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
});
const MODEL = process.env.DEEPSEEK_MODEL_ANALYST || 'deepseek-chat';

const SYSTEM = `You are Leonardo da Vinci, reborn as the creative director and conductor of SILKILINEN — a quiet-luxury silk & linen house. Your gift is seeing every discipline at once and fusing them into a single masterwork. You are handed everything the studio has produced — the goal and its pace, the latest situation brief, the inventions, the demand signals, the competitive field, what's been learned. Do not list it back. CONDUCT it.

Compose a 90-day symphony that makes the whole studio play as one toward the goal. Quiet-luxury throughout — ambitious and beautiful, never gimmicky, never discount/price-war moves. Ground every movement in what the studio actually has on the desk; be bold but buildable.

Respond ONLY with valid JSON:
{
  "vision": "2-3 sentences: the single unifying vision for the next 90 days — where this house is going and the feeling it will create.",
  "grandIdea": { "title": "the one audacious signature move", "what": "1-2 sentences", "why": "why it wins — the edge no rival has" },
  "movements": [
    { "title": "Movement name", "theme": "the through-line", "moves": ["3-4 concrete moves that weave content, social, demand, invention and the storefront together toward the goal"] }
  ],
  "closing": "one short, resonant line to the founder — warm, certain, the conductor's nod."
}
Exactly 3 movements, sequenced so they build. Make it feel like a masterwork, not a checklist.`;

async function unleashDaVinci() {
  if (!process.env.DEEPSEEK_API_KEY) return { error: 'AI not configured' };

  // 1. The orchestra plays — fire every due/forced agent in the BACKGROUND so
  //    fresh notes flow in, without making the founder wait on 15 AI calls.
  runGrowthEngine({ force: true })
    .then(r => console.log(`[davinci] background pulse: ${r.ran.join(', ')}`))
    .catch(err => console.warn('[davinci] background pulse failed:', err.message));

  // 2. A fresh situation brief (hardened — always returns), and the rest of the
  //    desk gathered in parallel.
  const [briefRes, star, competitors, playbook, recentActions, latestBrief] = await Promise.all([
    generateBrief().catch(() => null),
    northStarStatus().catch(() => null),
    getCompetitors().catch(() => []),
    getPlaybook().catch(() => ({ learnings: [] })),
    GrowthAction.find().sort({ createdAt: -1 }).limit(40)
      .select('agent type title detail').lean().catch(() => []),
    CEOBrief.findOne().sort({ createdAt: -1 }).lean().catch(() => null),
  ]);
  const brief = briefRes?.brief || latestBrief;

  // 3. Lay the desk out for the conductor — grouped so he can see the sections.
  const byType = (t) => recentActions.filter(a => a.type === t);
  const desk = [
    star
      ? `THE GOAL (AI Star): ${star.label} — ${star.current ?? '?'} / ${star.target} (${star.pct ?? 0}%), pace: ${star.pace}. ${star.guidance}`
      : 'THE GOAL: not set yet.',
    brief
      ? `THIS WEEK (Co-CEO brief): ${brief.headline}\n- Progress: ${brief.progress}\n- What's working: ${brief.whatsWorking}\n- The market: ${brief.marketRead || '—'}`
      : 'No brief yet.',
    `INVENTIONS ON THE DESK (Eureka): ${byType('eureka').map(a => `${a.title} — ${(a.detail || '').slice(0, 140)}`).join(' | ') || 'none yet'}`,
    `DEMAND WAVES: ${byType('demand_signal').map(a => a.title).join(', ') || 'none captured yet'}`,
    `COMPETITOR / STOREFRONT INTEL: ${recentActions.filter(a => a.agent === 'competitor' || a.agent === 'storefront').map(a => a.title).slice(0, 6).join(' | ') || 'none yet'}`,
    `THE VISITOR EXPERIENCE (Prometheus = clarity, Maui = delight): ${byType('experience').map(a => `${a.title} — ${(a.detail || '').slice(0, 120)}`).slice(0, 6).join(' | ') || 'not assessed yet'}`,
    `DRAFTS WAITING (content/social/newsletter): ${recentActions.filter(a => ['content', 'social', 'newsletter'].includes(a.agent)).map(a => a.title).slice(0, 8).join(' | ') || 'none yet'}`,
    `THE FIELD: ${competitors.length} competitor brands mapped.`,
    `WHAT WE'VE LEARNED WORKS: ${(playbook.learnings || []).join(' · ') || 'still learning — too early'}`,
    '',
    'Conduct it. Compose the masterwork. Return the JSON.',
  ].join('\n\n');

  let parsed = null;
  try {
    const res = await client.chat.completions.create(
      { model: MODEL, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: desk }], temperature: 0.7, max_tokens: 1400, response_format: { type: 'json_object' } },
      { timeout: 45000, maxRetries: 1 },
    );
    parsed = JSON.parse(res.choices[0]?.message?.content || '{}');
  } catch (err) {
    console.warn('[davinci] composition failed:', err.message);
    return { error: 'Da Vinci could not compose this time — give him a moment and unleash again.' };
  }
  if (!parsed.vision) return { error: 'The composition came back empty — unleash again.' };

  // Coerce movements to the exact schema (moves must be a string array) so a
  // mis-shaped AI response can't cast-error on save.
  const movements = (Array.isArray(parsed.movements) ? parsed.movements : []).slice(0, 3).map(m => ({
    title: String(m?.title || ''),
    theme: String(m?.theme || ''),
    moves: Array.isArray(m?.moves) ? m.moves.map(String) : (m?.moves ? [String(m.moves)] : []),
  })).filter(m => m.title);

  const composition = await DaVinciComposition.create({
    vision: String(parsed.vision),
    grandIdea: parsed.grandIdea || null,
    movements,
    closing: String(parsed.closing || ''),
    conducted: {
      eureka: byType('eureka').length,
      demand: byType('demand_signal').length,
      competitors: competitors.length,
      hadBrief: Boolean(brief),
    },
  });

  // A glowing mark in the pulse feed so the masterwork is unmistakable.
  await GrowthAction.create({
    agent: 'davinci',
    type: 'composition',
    title: `Da Vinci composed: ${parsed.grandIdea?.title || 'a 90-day symphony'}`,
    detail: parsed.vision.slice(0, 220),
    href: '/admin/growth',
    status: 'info',
    meta: { compositionId: String(composition._id) },
  }).catch(() => {});

  return { composition };
}

async function latestComposition() {
  return DaVinciComposition.findOne().sort({ createdAt: -1 }).lean();
}

module.exports = { unleashDaVinci, latestComposition };
