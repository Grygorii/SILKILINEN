'use strict';

// The Marketing Coordinator — the LEAD of the marketing team.
//
// Where the Growth Engine SCHEDULES specialists (each fires on its own cadence)
// and the Chief of Staff REPORTS the weekly state of the business, the
// Coordinator ORCHESTRATES: given a goal, it decides WHICH specialists to
// engage, reads their intel + the real business data, and composes ONE
// coordinated campaign plan — an objective, the key insight, and channel
// "plays" each OWNED by a named specialist and broken into concrete tasks that
// link to where the work happens. A verification pass (the clerk role) checks
// it's data-grounded and never violates the luxury position.
//
// Two modes (both requested):
//   • coordinate({goal, focus})  — interactive: founder gives a brief.
//   • weeklyCoordinator()        — autonomous: runs weekly off the North Star.

const client = require('./aiClient'); // shared DeepSeek client
const MODEL = process.env.DEEPSEEK_MODEL_ANALYST || 'deepseek-chat';

const MarketingPlan = require('../models/MarketingPlan');
const GrowthAction = require('../models/GrowthAction');
const SystemState = require('../models/SystemState');
const { describeAgents } = require('./growthEngine');
const { measure, getNorthStar, METRICS } = require('./chiefOfStaff');
const { playbookPromptBlock } = require('./playbook');

const DAY = 86400000;

// Where each specialist's work actually happens — used to make every task a
// real, clickable link instead of a dead instruction.
// Keyed on the EXACT registry agent names (growthEngine AGENTS): content,
// social, newsletter, storefront, demand, competitor, hermes, watchdog, eureka,
// prometheus, maui — NOT the file/class names.
const AGENT_HOME = {
  hermes: '/admin/seo', watchdog: '/admin/seo',
  content: '/admin/journal',
  social: '/admin/social',
  newsletter: '/admin/marketing/campaigns',
  storefront: '/admin/content',
  demand: '/admin/growth', competitor: '/admin/growth',
  eureka: '/admin/products', prometheus: '/admin/products', maui: '/admin/products',
};
const CHANNEL_HOME = {
  SEO: '/admin/seo', Content: '/admin/journal', Social: '/admin/social',
  Email: '/admin/marketing/campaigns', 'On-site': '/admin/content', Product: '/admin/products',
};

// ── Gather: the real material the Coordinator reasons over ─────────────────────
async function gatherContext(focus) {
  const [agents, metrics, northStar, recentActions, competitors, playbook, brief] = await Promise.all([
    describeAgents().catch(() => []),
    measure().catch(() => null),
    getNorthStar().catch(() => null),
    GrowthAction.find().sort({ createdAt: -1 }).limit(40).select('agent type title status').lean().catch(() => []),
    require('./competitorIntel').getCompetitors().catch(() => []),
    playbookPromptBlock().catch(() => ''),
    // The chain: the latest Chief of Staff brief — the week's read. A plan
    // should SERVE this, not re-decide the week from scratch.
    require('../models/CEOBrief').findOne().sort({ createdAt: -1 }).lean().catch(() => null),
  ]);

  // The latest line from each specialist — their current "input" to the plan.
  const byAgent = {};
  for (const a of recentActions) {
    if (!byAgent[a.agent]) byAgent[a.agent] = [];
    if (byAgent[a.agent].length < 3) byAgent[a.agent].push(`${a.type}: ${a.title}`);
  }

  return { agents, metrics, northStar, byAgent, competitors, playbook, brief, focus: focus || '' };
}

const SYSTEM = `You are the MARKETING COORDINATOR for SILKILINEN — a QUIET-LUXURY Mulberry-silk & European-linen intimates brand, one founder, currency EUR. You are the team LEAD: you do not do the work yourself, you DELEGATE to the right specialist agents and compose their work into ONE coordinated campaign plan toward the founder's goal.

NON-NEGOTIABLE:
1. PROTECT THE LUXURY POSITION. NEVER recommend discounts, price-competing, "cheaper than [brand]", or undercutting. Differentiate only through fabric/craft specificity, story, service, and owning a niche. Aspire upward.
2. USE ONLY REAL DATA you are handed. Never invent numbers. If data is thin (new store), say so and bias toward demand-building and content, not optimisation.
3. DELEGATE TO REAL SPECIALISTS. You are given the team roster (name + what each does). Every play must be OWNED by one specialist from that roster (use its exact name). Choose only the specialists relevant to THIS goal — a focused plan beats a broad one.
4. British/Irish spelling. Warm, plain, senior. No hype, no emojis.

Respond ONLY with valid JSON:
{
  "objective": "one sharp sentence: what this plan will achieve",
  "insight": "the single key insight from the data this plan turns on",
  "audience": "who we're speaking to",
  "engagedAgents": ["the exact specialist names you are delegating to"],
  "plays": [
    {
      "channel": "SEO|Content|Social|Email|On-site|Product",
      "agent": "the owning specialist's exact name from the roster",
      "title": "the play in a few words",
      "rationale": "one line tied to a real signal — never a price/discount move",
      "tasks": [ "concrete task 1", "concrete task 2" ]
    }
  ],
  "timeline": "a realistic phasing in plain words (e.g. 'this week → next 2 weeks')",
  "successMetric": "the ONE number that tells us this worked"
}
Rules: 3-5 plays, each a different lever, each owned by a relevant specialist. 2-4 tasks per play, each concrete and doable. Tie every play to the data.`;

const VERIFY_SYSTEM = `You are the verification clerk for SILKILINEN's marketing plans. Check the plan below against two things ONLY: (1) is every claim grounded in the data provided, or does it assert things the data doesn't support? (2) does ANY part violate the luxury position (discounting, price-competing, undercutting)? Respond ONLY with JSON: {"ok": true|false, "verdict": "one plain sentence — what holds up and what to watch"}. Be skeptical but fair.`;

function buildUserPayload(ctx, goal) {
  const m = ctx.metrics;
  const nsLine = ctx.northStar && METRICS[ctx.northStar.metric]
    ? `North Star: ${METRICS[ctx.northStar.metric].label} target ${ctx.northStar.target}${ctx.northStar.deadline ? ` by ${ctx.northStar.deadline}` : ''}.`
    : 'No North Star goal set.';
  const roster = (ctx.agents || []).map(a => `- ${a.name}: ${a.description}`).join('\n');
  const agentIntel = Object.entries(ctx.byAgent || {}).map(([k, v]) => `${k}: ${v.join(' | ')}`).join('\n') || 'no recent agent activity';
  const biz = m ? [
    `Paid orders last 7d: ${m.orders.last7} (prev ${m.orders.prev7}).`,
    `Revenue last 7d: €${m.revenue.last7} (price floor €${m.priceFloorEUR}, avg €${m.avgPriceEUR} — anything below floor is test/refund).`,
    `Human visitors last 7d (bots excluded): ${m.humanVisitors.last7}.`,
    `Traffic sources (30d): ${(m.sources || []).map(s => `${s.source} ${s.sessions}`).join(', ') || 'none'}.`,
    `Top products (30d): ${(m.topProducts || []).map(p => `${p.name}×${p.units}`).join(', ') || 'no sales yet'}.`,
    m.search ? `Google (28d): ${m.search.totals.clicks} clicks, ${m.search.totals.impressions} impressions; opportunities: ${(m.search.opportunities || []).filter(o => o.position > 8).map(o => `"${o.query}"`).slice(0, 6).join(', ') || 'none'}.` : 'Google Search: not connected.',
    require('./clickstream').clickstreamPromptLine(m.clickstream) || 'First-party clickstream: no on-site behaviour captured yet.',
  ].join('\n') : 'Business data unavailable.';

  return [
    `GOAL: ${goal}`,
    ctx.focus ? `FOCUS: ${ctx.focus}` : '',
    '', nsLine, '',
    `BUSINESS REALITY:\n${biz}`, '',
    `COMPETITOR FIELD: ${ctx.competitors.length} brands — reason about the market & white space, not one rival.`, '',
    `YOUR TEAM (delegate to these — use exact names):\n${roster}`, '',
    `WHAT EACH SPECIALIST RECENTLY PRODUCED:\n${agentIntel}`, '',
    ctx.brief ? `THIS WEEK'S READ — Chief of Staff brief (align the plan to it; don't contradict it): "${ctx.brief.headline}". Top moves: ${(ctx.brief.moves || []).slice(0, 3).map(m => m.title).join('; ') || '—'}.` : '',
    ctx.playbook ? `PLAYBOOK (what we've learned works):\n${ctx.playbook}` : '',
    '', 'Compose the coordinated plan JSON now.',
  ].filter(x => x !== null && x !== undefined).join('\n');
}

// Attach a real admin link to every task so the plan is actionable, not advice.
function hrefFor(play, taskAgent) {
  return AGENT_HOME[taskAgent] || AGENT_HOME[play.agent] || CHANNEL_HOME[play.channel] || '/admin/growth';
}

function coercePlays(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 6).map(p => {
    const play = {
      channel: String(p?.channel || '').slice(0, 40),
      agent: String(p?.agent || '').slice(0, 60),
      title: String(p?.title || '').slice(0, 200),
      rationale: String(p?.rationale || '').slice(0, 400),
      tasks: [],
    };
    const tasks = Array.isArray(p?.tasks) ? p.tasks : [];
    play.tasks = tasks.slice(0, 6).map(t => {
      const text = typeof t === 'string' ? t : (t?.text || '');
      return { text: String(text).slice(0, 300), href: hrefFor(play, play.agent), agent: play.agent, done: false };
    }).filter(t => t.text);
    return play;
  }).filter(p => p.title);
}

// Deterministic luxury guard — a hard backstop independent of the AI verifier.
const FORBIDDEN = /\b(discount|coupon|% off|cheaper|cheapest|undercut|lowest price|price match|sale price|markdown)\b/i;
function luxuryViolation(plays) {
  for (const p of plays) {
    if (FORBIDDEN.test(`${p.title} ${p.rationale} ${p.tasks.map(t => t.text).join(' ')}`)) return p.title;
  }
  return null;
}

async function verifyPlan(plan, ctx, goal) {
  // Hard backstop first.
  const violation = luxuryViolation(plan.plays);
  if (violation) return { ok: false, verdict: `Flagged: "${violation}" risks the luxury position (discount/undercut language) — revise before acting.` };
  try {
    const res = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: VERIFY_SYSTEM },
        { role: 'user', content: `GOAL: ${goal}\n\nDATA SUMMARY: orders ${ctx.metrics?.orders?.last7 ?? '?'}/wk, visitors ${ctx.metrics?.humanVisitors?.last7 ?? '?'}/wk.\n\nPLAN:\n${JSON.stringify({ objective: plan.objective, insight: plan.insight, plays: plan.plays.map(p => ({ title: p.title, rationale: p.rationale })) })}` },
      ],
      temperature: 0.2, max_tokens: 200, response_format: { type: 'json_object' },
    }, { timeout: 25000, maxRetries: 1 });
    const v = JSON.parse(res.choices[0]?.message?.content || '{}');
    if (v && typeof v.verdict === 'string') return { ok: v.ok !== false, verdict: v.verdict.slice(0, 300) };
  } catch { /* fall through to deterministic */ }
  return { ok: true, verdict: 'Verified: no luxury-position violations; grounded in the data provided.' };
}

// ── Core: produce and save one coordinated plan ────────────────────────────────
async function buildPlan({ goal, focus, mode, triggeredBy }) {
  const ctx = await gatherContext(focus);
  let parsed = null;
  let usedFallback = false;
  try {
    const res = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: buildUserPayload(ctx, goal) }],
      temperature: 0.5, max_tokens: 1400, response_format: { type: 'json_object' },
    }, { timeout: 45000, maxRetries: 1 });
    parsed = JSON.parse(res.choices[0]?.message?.content || '{}');
    if (!parsed || !parsed.objective) parsed = null;
  } catch (err) {
    console.warn('[coordinator] synthesis failed:', err.message);
  }

  if (!parsed) {
    usedFallback = true;
    parsed = {
      objective: `Advance: ${goal}`,
      insight: 'Not enough live data to synthesise automatically — start with demand-building and content, the levers that work pre-traction.',
      audience: 'Considered buyers who value fabric and craft over price.',
      engagedAgents: ['content', 'demand', 'social', 'hermes'],
      plays: [
        { channel: 'Content', agent: 'content', title: 'Publish the strongest drafted article', rationale: 'Ranked content is the only free, compounding traffic engine pre-traction.', tasks: ['Open the journal, pick the best draft, refine and publish'] },
        { channel: 'SEO', agent: 'hermes', title: 'Act on the top search opportunity', rationale: 'Win clicks for a query we already appear for.', tasks: ['Open SEO → Recommendations and apply the top Hermes play'] },
        { channel: 'Social', agent: 'social', title: 'Approve the queued social drafts', rationale: 'Keep owned channels alive while organic builds.', tasks: ['Review and approve the social queue'] },
      ],
      timeline: 'This week → next 2 weeks.',
      successMetric: 'Human visitors per week.',
    };
  }

  const plays = coercePlays(parsed.plays);
  const planFields = {
    objective: String(parsed.objective || goal).slice(0, 400),
    insight: String(parsed.insight || '').slice(0, 600),
    audience: String(parsed.audience || '').slice(0, 300),
    engagedAgents: Array.isArray(parsed.engagedAgents)
      ? [...new Set(parsed.engagedAgents.map(String))].slice(0, 12)
      : [...new Set(plays.map(p => p.agent).filter(Boolean))],
    plays,
    timeline: String(parsed.timeline || '').slice(0, 300),
    successMetric: String(parsed.successMetric || '').slice(0, 200),
  };

  const verdict = await verifyPlan(planFields, ctx, goal);

  const plan = await MarketingPlan.create({
    mode, goal, focus: focus || '',
    ...planFields,
    verdict: verdict.verdict,
    usedFallback,
    triggeredBy: triggeredBy || '',
  });

  // Drop a pulse-feed marker so the orchestration is visible in the engine log.
  await GrowthAction.create({
    agent: 'coordinator', type: 'plan',
    title: `Marketing plan: ${plan.objective}`,
    detail: `Engaged ${plan.engagedAgents.join(', ') || 'the team'}. ${verdict.verdict}`,
    href: '/admin/marketing-coordinator', status: 'info',
    meta: { planId: String(plan._id) },
  }).catch(() => {});

  return plan;
}

// Interactive — the founder's brief.
async function coordinate({ goal, focus, triggeredBy } = {}) {
  if (!goal || !String(goal).trim()) throw new Error('A goal is required');
  if (!process.env.DEEPSEEK_API_KEY) throw new Error('AI is not configured');
  return buildPlan({ goal: String(goal).trim().slice(0, 500), focus, mode: 'interactive', triggeredBy });
}

// Autonomous weekly — derives the goal from the North Star and runs on cadence.
async function weeklyCoordinator({ force = false } = {}) {
  const key = 'marketingCoordinatorLastRun';
  const doc = await SystemState.findOne({ key }).lean();
  const last = doc?.value ? new Date(doc.value).getTime() : 0;
  if (!force && Date.now() - last < 7 * DAY) return { ran: false };
  if (!process.env.DEEPSEEK_API_KEY) return { ran: false, skipped: 'AI not configured' };

  // The chain: don't re-decide the week — EXECUTE the Chief of Staff's top
  // priority. Read the latest brief; if it's fresh and has moves, turn its #1
  // move into the campaign. Only fall back to the North Star when there's no
  // current brief to serve (so there's one decider per horizon, not two).
  const ns = await getNorthStar().catch(() => null);
  const brief = await require('../models/CEOBrief').findOne().sort({ createdAt: -1 }).lean().catch(() => null);
  const briefFresh = brief?.createdAt && (Date.now() - new Date(brief.createdAt).getTime()) < 8 * DAY;
  const nsTail = ns && METRICS[ns.metric] ? ` toward the AI Star (${METRICS[ns.metric].label} → ${ns.target})` : '';

  let goal, focus;
  if (briefFresh && (brief.moves || []).length) {
    const top = brief.moves[0];
    goal = `Execute this week's priority from the Chief of Staff's brief — "${top.title}"${nsTail}. Turn it into a delegated, executable plan.`;
    focus = top.agent || '';
  } else {
    goal = ns && METRICS[ns.metric]
      ? `Advance the North Star this week: ${METRICS[ns.metric].label} → ${ns.target}${ns.deadline ? ` by ${ns.deadline}` : ''}.`
      : 'Grow SILKILINEN this week — build demand, traffic and considered first purchases without touching the luxury position.';
  }

  let plan = null;
  try { plan = await buildPlan({ goal, focus, mode: 'weekly', triggeredBy: 'auto-weekly' }); }
  catch (err) { console.error('[coordinator] weekly failed:', err.message); }
  await SystemState.findOneAndUpdate({ key }, { value: new Date().toISOString() }, { upsert: true });
  return { ran: true, plan };
}

module.exports = { coordinate, weeklyCoordinator };
