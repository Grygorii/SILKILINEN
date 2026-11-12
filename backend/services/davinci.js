'use strict';

// Strategy reads current evidence and completed recent work; it never starts a hidden agent pulse.
const DaVinciComposition = require('../models/DaVinciComposition');
const CEOBrief = require('../models/CEOBrief');
const GrowthAction = require('../models/GrowthAction');
const { generateBrief, northStarStatus } = require('./chiefOfStaff');
const { loadEvidence, evidencePrompt } = require('./commerceEvidence');
const { withWorkflowLease } = require('./workflowLease');
const SystemState = require('../models/SystemState');
const { getCompetitors } = require('./competitorIntel');
const { getPlaybook } = require('./playbook');

const client = require('./aiClient'); // shared DeepSeek client
const MODEL = process.env.DEEPSEEK_MODEL_ANALYST || 'deepseek-chat';

const SYSTEM = `You are SILKILINEN's practical luxury-commerce strategist. Use only the dated evidence supplied. The shop is live: do not call it pre-launch when ledger purchases exist. Unknown attribution is not zero sales. Impressions are not buying demand; locations do not prove bots. Older ideas are hypotheses, not facts. Do not assert an unoccupied competitive niche without evidence. Never invent manufacturing origins, customer feedback, guarantees or services the founder has not approved. Products are designed in Ireland and manufactured in mixed locations.
Return JSON with vision (an evidence-led plan, not a sales promise), grandIdea {title,what,why}, exactly three movements {title,theme,moves:string[]}, and closing. Each move must say what changes, which observation supports it, the measured outcome, and the review date. Limit to six moves total: measurement first, then a commercial test, then a review checkpoint. Prefer existing products/pages to speculative tools. No discounts or guaranteed sales. Public changes remain drafts.`;
async function unleashDaVinci() { return withWorkflowLease('growth-strategy', composeStrategy); }
async function composeStrategy(assertLease = () => {}) {
  if (!process.env.DEEPSEEK_API_KEY) return { error: 'AI not configured' };
  if (await SystemState.exists({ key: 'workflowLease:growth-pulse', 'value.until': { $gt: Date.now() } })) return { error: 'The agent pulse is still running. Finish it before generating a strategy from its results.' };
  const commerce = await loadEvidence(30, { fresh: true });
  // 2. A fresh situation brief (hardened — always returns), and the rest of the
  //    desk gathered in parallel.
  const [briefRes, star, competitors, playbook, recentActions, latestBrief] = await Promise.all([
    generateBrief().catch(() => null),
    northStarStatus().catch(() => null),
    getCompetitors().catch(() => []),
    getPlaybook().catch(() => ({ learnings: [] })),
    GrowthAction.find({ createdAt: { $gte: new Date(Date.now() - 30 * 86400000) }, status: { $nin: ['error', 'rejected'] } }).sort({ createdAt: -1 }).limit(40)
      .select('agent type title detail').lean().catch(() => []),
    CEOBrief.findOne().sort({ createdAt: -1 }).lean().catch(() => null),
  ]);
  const candidate = briefRes?.brief || latestBrief;
  const brief = candidate && Date.now() - new Date(candidate.createdAt).getTime() < 8 * 86400000 ? candidate : null;

  // 3. Lay the desk out for the conductor — grouped so he can see the sections.
  const byType = (t) => recentActions.filter(a => a.type === t);
  const desk = [
    `Generated ${new Date().toISOString()}. Agent output is advisory, not purchase evidence.`,
    evidencePrompt(commerce),
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
    `SEARCH FOOTHOLDS (Hermes — how people already find us on Google, and how to win more clicks): ${byType('seo').map(a => `${a.title} — ${(a.detail || '').slice(0, 120)}`).slice(0, 6).join(' | ') || 'not mapped yet'}`,
    `DRAFTS WAITING (content/social/newsletter): ${recentActions.filter(a => ['content', 'social', 'newsletter'].includes(a.agent)).map(a => a.title).slice(0, 8).join(' | ') || 'none yet'}`,
    `THE FIELD: ${competitors.length} competitor brands mapped.`,
    `PRIOR PLAYBOOK NOTES (advisory; verify before treating as facts): ${(playbook.learnings || []).join(' · ') || 'still learning — too early'}`,
    '',
    'Conduct it. Compose the masterwork. Return the JSON.',
  ].join('\n\n');

  let parsed = null;
  try {
    const res = await client.chat.completions.create(
      { model: MODEL, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: desk }], temperature: 0.3, max_tokens: 1400, response_format: { type: 'json_object' } },
      { timeout: 45000, maxRetries: 0 },
    );
    parsed = JSON.parse(res.choices[0]?.message?.content || '{}');
  } catch (err) {
    console.warn('[davinci] composition failed:', err.message);
    return { error: 'Da Vinci could not compose this time — give him a moment and unleash again.' };
  }
  if (typeof parsed.vision !== 'string' || !parsed.vision.trim() || !Array.isArray(parsed.movements) || parsed.movements.length !== 3) return { error: 'The strategy response was incomplete. Previous strategy retained.' };

  // Coerce movements to the exact schema (moves must be a string array) so a
  // mis-shaped AI response can't cast-error on save.
  const movements = (Array.isArray(parsed.movements) ? parsed.movements : []).slice(0, 3).map(m => ({
    title: String(m?.title || ''),
    theme: String(m?.theme || ''),
    moves: Array.isArray(m?.moves) ? m.moves.filter(value => typeof value === 'string' && value.trim()).slice(0, 2) : [],
  })).filter(m => m.title);

  if (movements.length !== 3 || movements.some(movement => !movement.moves.length)) return { error: 'The strategy lacks actionable steps. Previous strategy retained.' };
  assertLease();
  const composition = await DaVinciComposition.create({
    vision: String(parsed.vision),
    grandIdea: parsed.grandIdea || null,
    movements,
    closing: String(parsed.closing || ''),
    conducted: {
      evidenceAt: new Date().toISOString(), orderSummary: commerce.summary, adviceWindowDays: 30,
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
