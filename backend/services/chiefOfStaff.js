'use strict';

// The Chief of Staff — the brain of the Growth Engine. Where the specialist
// agents DO things, this one THINKS: once a week it runs the operator's loop
//
//   measure (where are we vs the North Star?)
//   → attribute (what changed, and likely why?)
//   → learn (what's actually working, from the outcomes of past moves?)
//   → decide (the few highest-leverage moves) → delegate to the agents
//   → and the 1-3 things only the founder can do.
//
// It is the organ that makes the system LEARN: it reads the outcomes of what
// the agents did weeks ago (did that article gain Search Console impressions?
// did orders move?) and biases next week toward what worked. Everything is
// computed from real data; the AI only synthesises the brief from numbers it
// is handed — it never invents figures.

const SystemState = require('../models/SystemState');
const CEOBrief = require('../models/CEOBrief');
const GrowthAction = require('../models/GrowthAction');
const Order = require('../models/Order');
const Visit = require('../models/Visit');
const JournalArticle = require('../models/JournalArticle');
const { mergeLearnings, playbookPromptBlock } = require('./playbook');

const client = require('./aiClient'); // shared DeepSeek client
const MODEL = process.env.DEEPSEEK_MODEL_ANALYST || 'deepseek-chat';

const NORTH_STAR_KEY = 'growthNorthStar';
const PAID = ['paid', 'shipped', 'delivered'];
const DAY = 86400000;

// Cities that are search-engine / cloud data centres, not shoppers. The brain
// must remember what we proved: a chunk of "visits" are bots. Reasoning on
// human visits keeps it from mistaking crawler traffic for demand.
const DATA_CENTRE_CITIES = [
  'San Jose', 'Mountain View', 'The Dalles', 'Council Bluffs',
  'Ashburn', 'Boardman', 'Columbus', 'Santa Clara',
];
const humanVisitMatch = (range) => ({ ...range, city: { $nin: DATA_CENTRE_CITIES } });

// One brief used to make Search Console's getSearchPerformance() three times.
// Memoise for 60s so a single generation hits the network once, not thrice —
// faster, and fewer chances for a slow external call to stall the request.
let _perfCache = null;
async function cachedSearchPerf() {
  if (_perfCache && Date.now() - _perfCache.at < 60000) return _perfCache.val;
  let val = null;
  try {
    const gsc = require('./searchConsole');
    if (await gsc.isConnected()) val = await gsc.getSearchPerformance(28);
  } catch { val = null; }
  _perfCache = { at: Date.now(), val };
  return val;
}

// ── North Star (the goal) ──────────────────────────────────────────────────────

const METRICS = {
  orders_per_month:   { label: 'Orders per month',   unit: '' },
  revenue_per_month:  { label: 'Revenue per month',  unit: '€' },
  search_clicks:      { label: 'Google clicks / month', unit: '' },
  visitors_per_month: { label: 'Visitors per month', unit: '' },
};

async function getNorthStar() {
  const doc = await SystemState.findOne({ key: NORTH_STAR_KEY }).lean();
  return (doc && doc.value) || null;
}

async function setNorthStar({ metric, target, deadline, note }) {
  if (!METRICS[metric]) throw new Error('Unknown metric');
  const t = Number(target);
  if (!Number.isFinite(t) || t <= 0) throw new Error('Target must be a positive number');
  const value = { metric, target: t, deadline: deadline || null, note: note || '', setAt: new Date().toISOString() };
  await SystemState.findOneAndUpdate({ key: NORTH_STAR_KEY }, { value }, { upsert: true });
  return value;
}

// The AI Star is a LIVING guide, not a number on a wall. It watches the pace
// against the deadline and speaks: on track, drifting, or achieved — with the
// concrete gap and where to look. This is what makes it a star that can reach
// down and steer, not just hang there.
async function northStarStatus() {
  const ns = await getNorthStar();
  if (!ns) return null;
  const current = await currentValue(ns.metric);
  const target = ns.target;
  const pct = current != null && target > 0 ? Math.round((current / target) * 100) : null;
  const label = METRICS[ns.metric].label;
  const now = Date.now();
  const setAt = ns.setAt ? new Date(ns.setAt).getTime() : now;
  // Month input ("2026-11") or full date — normalise to a timestamp.
  const deadline = ns.deadline
    ? new Date(ns.deadline.length === 7 ? `${ns.deadline}-01` : ns.deadline).getTime()
    : null;

  let pace = 'measuring';
  let guidance = '';
  if (current == null) {
    guidance = `Connect the data for ${label.toLowerCase()} and I'll track your pace.`;
  } else if (pct >= 100) {
    pace = 'achieved';
    guidance = `You've reached it — ${current} vs ${target}. Time to raise the star higher.`;
  } else if (deadline && deadline > setAt) {
    const elapsed = Math.min(1, Math.max(0, (now - setAt) / (deadline - setAt)));
    const expectedPct = Math.round(elapsed * 100);
    const monthsLeft = Math.max(0, (deadline - now) / (30 * DAY));
    const gap = Math.max(0, Math.round((target - current) * 100) / 100);
    if (pct + 8 >= expectedPct) {
      pace = 'on track';
      guidance = `On pace — ${current} of ${target} ${label.toLowerCase()} (${pct}%). Hold the course: keep approving the engine's moves.`;
    } else {
      pace = 'drifting';
      const perMonth = monthsLeft >= 1 ? `~${(gap / monthsLeft).toFixed(1)}/month` : 'this month';
      guidance = `Drifting — ${pct}% of target but ${expectedPct}% of the time to ${ns.deadline} is gone. You need +${gap} more (${perMonth}). Open this week's brief — that's your correction.`;
    }
  } else {
    pace = 'no deadline';
    guidance = `${pct ?? 0}% there (${current}/${target}). Add a "by when" date and I'll watch your pace and warn you the moment you drift.`;
  }
  return { current, target, pct, label, pace, guidance, deadline: ns.deadline || null };
}

// ── Measure: where are we, and how did we move? ────────────────────────────────

async function currentValue(metric) {
  const since30 = new Date(Date.now() - 30 * DAY);
  if (metric === 'orders_per_month') {
    return Order.countDocuments({ status: { $in: PAID }, createdAt: { $gte: since30 } });
  }
  if (metric === 'revenue_per_month') {
    const r = await Order.aggregate([
      { $match: { status: { $in: PAID }, createdAt: { $gte: since30 } } },
      { $group: { _id: null, v: { $sum: '$total' } } },
    ]);
    return Math.round((r[0]?.v || 0) * 100) / 100;
  }
  if (metric === 'visitors_per_month') {
    const r = await Visit.aggregate([
      { $match: { createdAt: { $gte: since30 } } },
      { $group: { _id: '$sessionId' } }, { $count: 'n' },
    ]);
    return r[0]?.n || 0;
  }
  if (metric === 'search_clicks') {
    try {
      const gsc = require('./searchConsole');
      if (await gsc.isConnected()) return (await gsc.getSearchPerformance(28)).totals.clicks;
    } catch { /* fall through */ }
    return null;
  }
  return null;
}

async function measure() {
  const since7 = new Date(Date.now() - 7 * DAY);
  const since14 = new Date(Date.now() - 14 * DAY);
  const since30 = new Date(Date.now() - 30 * DAY);

  const [ordersThis, ordersPrev, revThis, revPrev, visThis, visPrev, priceStats, anomalies, activeProducts] = await Promise.all([
    Order.countDocuments({ status: { $in: PAID }, createdAt: { $gte: since7 } }),
    Order.countDocuments({ status: { $in: PAID }, createdAt: { $gte: since14, $lt: since7 } }),
    Order.aggregate([{ $match: { status: { $in: PAID }, createdAt: { $gte: since7 } } }, { $group: { _id: null, v: { $sum: '$total' } } }]),
    Order.aggregate([{ $match: { status: { $in: PAID }, createdAt: { $gte: since14, $lt: since7 } } }, { $group: { _id: null, v: { $sum: '$total' } } }]),
    // Visitors, bot-aware: exclude data-centre cities so crawlers aren't counted as shoppers.
    Visit.aggregate([{ $match: humanVisitMatch({ createdAt: { $gte: since7 } }) }, { $group: { _id: '$sessionId' } }, { $count: 'n' }]),
    Visit.aggregate([{ $match: humanVisitMatch({ createdAt: { $gte: since14, $lt: since7 } }) }, { $group: { _id: '$sessionId' } }, { $count: 'n' }]),
    // Catalogue price floor — priced products only, so one unpriced/draft row
    // can't drag the floor (and the whole "is this a real sale" check) to €0.
    Product.aggregate([{ $match: { status: { $in: ['active', 'sold_out'] }, price: { $gt: 0 } } }, { $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' }, avg: { $avg: '$price' } } }]),
    // Orders whose total is below the cheapest product = test / refund / data anomaly, NOT real sales.
    Order.aggregate([
      { $match: { status: { $in: PAID }, createdAt: { $gte: since30 } } },
      { $group: { _id: null, total: { $sum: 1 }, revenue: { $sum: '$total' }, minOrder: { $min: '$total' } } },
    ]),
    // Active catalogue size — the authoritative "do we have products" signal, so
    // the brain never mistakes a €0 price-floor glitch for an empty catalogue.
    Product.countDocuments({ status: { $in: ['active', 'sold_out'] } }),
  ]);

  const floor = priceStats[0]?.min || 0;
  const anomalyCount = floor > 0
    ? await Order.countDocuments({ status: { $in: PAID }, createdAt: { $gte: since30 }, total: { $lt: floor } })
    : 0;

  // Traffic sources & top products (30d) — context for attribution.
  const [sources, topProducts] = await Promise.all([
    Visit.aggregate([
      { $match: { createdAt: { $gte: since30 } } },
      { $group: { _id: { s: '$sessionId', src: '$source' } } },
      { $group: { _id: '$_id.src', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 5 },
    ]),
    Order.aggregate([
      { $match: { status: { $in: PAID }, createdAt: { $gte: since30 } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.name', units: { $sum: '$items.quantity' } } },
      { $sort: { units: -1 } }, { $limit: 5 },
    ]),
  ]);

  // Search Console signal (real demand from the internet, not just the site).
  let search = null;
  try {
    const perf = await cachedSearchPerf();
    if (perf) {
      const gsc = require('./searchConsole');
      const opps = await gsc.getQueryOpportunities(28).catch(() => []);
      const countries = await gsc.getCountryBreakdown(28).catch(() => []);
      search = { totals: perf.totals, topQueries: perf.topQueries, opportunities: (opps || []).slice(0, 10), countries: (countries || []).slice(0, 6) };
    }
  } catch { /* GSC optional */ }

  // First-party clickstream — the on-site funnel, searches and clicks. Until now
  // no agent read this; the brain reasons over it alongside orders and GSC.
  const clickstream = await require('./clickstream').getClickstreamSignals(14).catch(() => null);

  return {
    orders: { last7: ordersThis, prev7: ordersPrev },
    revenue: { last7: Math.round((revThis[0]?.v || 0) * 100) / 100, prev7: Math.round((revPrev[0]?.v || 0) * 100) / 100 },
    humanVisitors: { last7: visThis[0]?.n || 0, prev7: visPrev[0]?.n || 0 },
    activeProducts,
    priceFloorEUR: Math.round(floor * 100) / 100,
    priceCeilingEUR: Math.round((priceStats[0]?.max || 0) * 100) / 100,
    avgPriceEUR: Math.round((priceStats[0]?.avg || 0) * 100) / 100,
    anomalousOrders30d: anomalyCount, // orders below the cheapest product → test/refund/data, not sales
    sources: sources.map(s => ({ source: s._id || 'direct', sessions: s.n })),
    topProducts: topProducts.map(p => ({ name: p._id, units: p.units })),
    search,
    clickstream,
  };
}

// ── Learn: did past moves actually work? ───────────────────────────────────────
// Match published articles (born as Growth Engine drafts) to their real Search
// Console performance. This is the feedback loop — the system seeing the fruit
// of what it did, so it can do more of what works.
async function contentOutcomes() {
  const published = await JournalArticle.find({ status: 'published' })
    .select('title slug publishedAt keywords').sort({ publishedAt: -1 }).limit(15).lean();
  if (!published.length) return [];

  let pageData = {};
  try {
    const perf = await cachedSearchPerf();
    if (perf) for (const row of perf.topPages || []) pageData[row.key] = row;
  } catch { /* optional */ }

  return published.map(a => {
    const urlMatch = Object.keys(pageData).find(u => u.includes(`/journal/${a.slug}`));
    const stats = urlMatch ? pageData[urlMatch] : null;
    const ageDays = a.publishedAt ? Math.round((Date.now() - new Date(a.publishedAt).getTime()) / DAY) : null;
    return {
      title: a.title,
      target: a.keywords?.[0] || '',
      ageDays,
      clicks: stats?.clicks ?? 0,
      impressions: stats?.impressions ?? 0,
      verdict: stats && stats.impressions > 20 ? 'gaining traction' : (ageDays && ageDays > 30 ? 'not ranking yet' : 'too early'),
    };
  });
}

// Competitor-feature ideas the scouts surfaced — the "features €500k agencies
// build" the founder asked to harvest. Pulled from recent scout actions so the
// brief can recommend which to build.
async function buildIdeaCandidates() {
  const actions = await GrowthAction.find({ agent: { $in: ['competitor', 'storefront'] } })
    .sort({ createdAt: -1 }).limit(8).lean();
  return actions.map(a => ({ title: a.title, detail: (a.detail || '').slice(0, 300), agent: a.agent }));
}

// The Clerks' verdict — the one line the brief opens with. Reads the last
// week of the Logic Clerk (chain audit) and Reasoning Clerk (fact-check) and
// tells the founder, plainly, whether last week's work held together and how
// many claims didn't stand up. Keyed off the clerks' meta contract (flags carry
// meta.severity / meta.verdict; the all-clear runs don't), not fragile titles.
async function clerksVerdict() {
  const since7 = new Date(Date.now() - 7 * DAY);
  const actions = await GrowthAction.find({
    agent: { $in: ['logicClerk', 'reasoningClerk'] },
    createdAt: { $gte: since7 },
  }).sort({ createdAt: -1 }).select('agent type meta').lean().catch(() => []);
  if (!actions.length) return null;

  const logic = actions.filter(a => a.agent === 'logicClerk');
  const reasoning = actions.filter(a => a.agent === 'reasoningClerk');
  const chainAudited = logic.some(a => a.type === 'audit');
  const fireworkChecked = reasoning.some(a => a.type === 'reasoning');
  const logicFlags = logic.filter(a => a.meta && (a.meta.severity === 'high' || a.meta.severity === 'low')).length;
  const fireworks = reasoning.filter(a => a.meta && (a.meta.verdict === 'firework' || a.meta.verdict === 'shaky')).length;

  const parts = [];
  if (chainAudited) {
    parts.push(logicFlags
      ? `the logic chain has ${logicFlags} broken link${logicFlags === 1 ? '' : 's'} to fix`
      : 'the logic chain held — no contradictions across the agents');
  }
  if (fireworkChecked) {
    parts.push(fireworks
      ? `${fireworks} claim${fireworks === 1 ? '' : 's'} flagged as unproven (“fireworks”) — verify before acting`
      : 'every claim stood up to the live evidence');
  }
  if (!parts.length) return null;
  return {
    line: `Clerks’ verdict: ${parts.join('; ')}.`,
    logicFlags, fireworks,
    chainHeld: chainAudited && logicFlags === 0,
  };
}

// ── Decide: synthesise the weekly brief ────────────────────────────────────────

const BRIEF_SYSTEM = `You are the Chief of Staff / co-CEO for SILKILINEN, a QUIET-LUXURY silk & linen brand run by one founder (currency EUR). Once a week you write a tight operating brief. Think like a seasoned luxury-brand operator AND a skeptical analyst — not a generic growth hacker.

THREE NON-NEGOTIABLE WAYS OF THINKING:

1. INTERROGATE THE DATA — never parrot it. You are told the catalogue price floor. If revenue or average-order-value is below the cheapest product, those are TEST orders, refunds, or a data glitch — say so plainly and exclude them; do NOT call €5 of revenue a "first revenue week". You are told how many visits are likely search-engine/data-centre BOTS — discount them; never call bot traffic "demand" or "a channel working". If a number looks impossible for this business, flag it as suspect rather than building a story on it.

2. PROTECT THE LUXURY POSITION — this is the cardinal rule. NEVER recommend competing on price, discounts, "we're cheaper than [premium brand]", or comparison-to-rival pages framed around being the affordable option. That destroys luxury equity (it is the Lidl-vs-Aldi move and it is forbidden). Differentiate ONLY through specificity, fabric/craft detail, story, service, and owning a niche the field ignores. Aspire upward, never undercut.

3. THINK GLOBALLY, NOT ABOUT TWO BRANDS — you are given the WHOLE competitor field (dozens of brands). Reason about the MARKET: where SILKILINEN sits in the price ladder, the positioning clusters, and the WHITE SPACE no one owns that SILKILINEN could. Never fixate on a single competitor; a brief that only mentions one rival has failed.

4. STAY ON BRAND TRUTH — SILKILINEN is "an Irish brand based in Donegal", but its products are made in mixed locations. NEVER recommend content, angles, articles or claims that state or imply the products are made in Ireland/Donegal or are "handmade" — "Irish linen", "made in Ireland", "Irish linen sleepwear" and the like are FORBIDDEN and off-positioning. Differentiate through fabric/craft specificity (mulberry silk, momme weight), feeling and story — never through origin claims.

You are handed REAL numbers — never invent any. Write in plain, warm, direct English (British/Irish spelling). No fluff, no hype, no emojis. Respond ONLY with valid JSON:
{
  "headline": "one sentence: the honest state of the business this week",
  "progress": "2-3 sentences: where we are vs the North Star goal and the realistic read",
  "whatChanged": "2-3 sentences: the notable deltas this week and the most likely cause (name it)",
  "whatsWorking": "2-3 sentences: what the data says is working (channels, products, content) and what is not",
  "marketRead": "2-3 sentences placing SILKILINEN in the WHOLE competitor field: its price position, the crowded positioning, and the white space it could own. Reference the field, not one brand.",
  "moves": [ { "title": "the move", "agent": "content|social|newsletter|demand|competitor|storefront|watchdog|founder", "why": "one line tied to the data — never a price/discount/undercut move" } ],
  "founderActions": [ "the 1-3 things only the founder can do this week, concrete" ],
  "buildIdeas": [ { "title": "a feature/capability worth building (from competitor intel)", "source": "competitor name or 'storefront'", "why": "the sales reason — never about being cheaper" } ],
  "learnings": [ "3-6 short, concrete, reusable rules distilled from the outcomes — these are fed back into every agent next week, so make them durable and specific (e.g. 'Hair-benefit article angles gain Search Console impressions fastest', 'Pinterest drives more pillowcase views than Instagram'). If data is too thin to learn anything real yet, return an empty array." ]
}
Rules: 3-4 moves max, each tied to a real number. buildIdeas only from the competitor/storefront material provided (0-3). If data is thin (new store), say so honestly and focus moves on building demand and content, not optimisation.`;

// Deterministic, data-honest brief — used when the AI is unavailable so the
// founder is never left with a stale brief. Applies the same skepticism the
// prompt demands: discount sub-floor "revenue", treat near-zero human traffic
// as no audience, never suggest undercutting.
function fallbackBriefFields(m, ns, competitors) {
  const realRevenue = m.anomalousOrders30d > 0
    ? `€${m.revenue.last7} of reported revenue this week is at or below your €${m.priceFloorEUR} price floor, so it is test/refund/anomalous — not real sales.`
    : `€${m.revenue.last7} revenue this week from ${m.orders.last7} paid order(s).`;
  const audience = (m.humanVisitors.last7 || 0) < 5
    ? `Real human visitors are essentially zero this week (${m.humanVisitors.last7}, bots excluded) — there is no audience to convert yet, so the job is attracting people, not optimising.`
    : `${m.humanVisitors.last7} human visitors this week (bots excluded).`;
  const progressLine = ns
    ? `You're at ${ns.current ?? 0} of ${ns.target} ${ns.label?.toLowerCase() || 'on your goal'} (${ns.pct ?? 0}%).`
    : 'No goal set yet — set your AI Star so the engine has a target.';
  return {
    headline: m.orders.last7 > 0 && m.anomalousOrders30d === 0
      ? `${m.orders.last7} real order(s) this week — early but real.`
      : `Pre-traction: the work right now is attracting your first real visitors.`,
    progress: `${progressLine} ${realRevenue}`,
    whatChanged: `${audience} Direct/own-network and bots dominate; no organic channel is firing yet.`,
    whatsWorking: m.search && m.search.totals.impressions > 0
      ? `Google shows ${m.search.totals.impressions} impressions but ${m.search.totals.clicks} clicks — you're being seen for a few queries; nothing is converting to traffic yet.`
      : `Nothing is driving real traffic yet — content and demand-building are the levers, not conversion tweaks.`,
    marketRead: `You sit in a crowded field of ${competitors.length} silk/sleepwear brands. Don't fight on price — own a specific niche (fabric story, considered service, a tightly-defined aesthetic) the big names ignore.`,
    moves: [
      { title: 'Publish the strongest drafted SEO article', agent: 'content', why: 'Each ranked article is a permanent door for new visitors — your only free traffic engine right now.' },
      { title: 'Run the Demand Scout and act on one rising search', agent: 'demand', why: 'Build content/products around real demand instead of guessing.' },
      { title: 'Approve the queued social drafts', agent: 'social', why: 'Keep the owned channels alive while organic builds.' },
    ],
    founderActions: [
      'Share the shop (and the new Style Finder) with your own network — the only warm audience you have today.',
      m.anomalousOrders30d > 0 ? 'Check the sub-floor orders in admin — confirm they are tests/refunds and not a pricing bug.' : 'Take the Style Finder yourself and sanity-check the recommendations.',
    ],
    buildIdeas: [],
    learnings: [],
  };
}

// Safe metrics shape so the brief can always render even if a query fails.
const SAFE_METRICS = {
  orders: { last7: 0, prev7: 0 }, revenue: { last7: 0, prev7: 0 },
  humanVisitors: { last7: 0, prev7: 0 }, activeProducts: 0, priceFloorEUR: 0, priceCeilingEUR: 0, avgPriceEUR: 0,
  anomalousOrders30d: 0, sources: [], topProducts: [], search: null,
};

// The model can return fields in slightly wrong shapes (moves as strings,
// founderActions as objects…). Coerce everything to the CEOBrief schema so
// Mongoose never cast-errors — the #1 cause of "Could not write a brief".
const asStr = (x) => (typeof x === 'string' ? x : x == null ? '' : (x.title || x.move || x.action || String(x)));
function coerceMoves(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 4).map(m => (typeof m === 'string'
    ? { title: m, agent: '', why: '' }
    : { title: asStr(m?.title), agent: asStr(m?.agent), why: asStr(m?.why) })).filter(m => m.title);
}
function coerceIdeas(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 3).map(i => (typeof i === 'string'
    ? { title: i, source: '', why: '' }
    : { title: asStr(i?.title), source: asStr(i?.source), why: asStr(i?.why) })).filter(i => i.title);
}
const coerceStrings = (arr) => (Array.isArray(arr) ? arr.slice(0, 3).map(asStr).filter(Boolean) : []);

// Public entry — guarantees a brief is written or a clean skip, NEVER a throw,
// so "New brief" can't 500. Layers: fail-soft gather → AI-or-fallback → coerced
// save with retry → and this outer net for anything unforeseen.
async function generateBrief() {
  if (!process.env.DEEPSEEK_API_KEY) return { skipped: 'AI not configured' };
  try {
    return await generateBriefCore();
  } catch (err) {
    console.error('[chief] generateBrief failed entirely, writing minimal brief:', err.message);
    try {
      const m = await measure().catch(() => SAFE_METRICS);
      const fb = fallbackBriefFields(m, null, []);
      const brief = await CEOBrief.create({
        headline: fb.headline, progress: fb.progress, whatChanged: fb.whatChanged,
        whatsWorking: fb.whatsWorking, marketRead: fb.marketRead,
        moves: coerceMoves(fb.moves), founderActions: coerceStrings(fb.founderActions),
        buildIdeas: [], metrics: { usedFallback: true },
      });
      return { brief };
    } catch (e2) {
      return { error: e2.message };
    }
  }
}

async function generateBriefCore() {
  const { getCompetitors } = require('./competitorIntel');
  // Every gather is fail-soft — one slow/broken query can never sink the brief.
  const [northStar, metrics, outcomes, ideas, recentActions, competitors, clerks] = await Promise.all([
    getNorthStar().catch(() => null),
    measure().catch(e => { console.warn('[chief] measure failed:', e.message); return SAFE_METRICS; }),
    contentOutcomes().catch(() => []),
    buildIdeaCandidates().catch(() => []),
    GrowthAction.find().sort({ createdAt: -1 }).limit(20).select('agent type title status').lean().catch(() => []),
    getCompetitors().catch(() => []),
    clerksVerdict().catch(() => null),
  ]);

  // The chain: read Da Vinci's active 90-day direction so THIS WEEK serves the
  // quarter's vision instead of re-deriving direction. Lazy require avoids the
  // chiefOfStaff↔davinci cycle. Only used if a composition is recent (≤100d).
  const composition = await require('./davinci').latestComposition().catch(() => null);
  const compAgeDays = composition?.createdAt ? Math.round((Date.now() - new Date(composition.createdAt).getTime()) / DAY) : null;
  const directionLine = (composition && compAgeDays != null && compAgeDays <= 100)
    ? `ACTIVE 90-DAY DIRECTION (Da Vinci's vision, ${compAgeDays}d ago — make this week's moves serve it): ${composition.grandIdea?.title ? `"${composition.grandIdea.title}" — ` : ''}${(composition.vision || '').slice(0, 300)}`
    : '';

  let nsBlock = 'No North Star goal set yet.';
  let nsForStore = null;
  if (northStar && METRICS[northStar.metric]) {
    const current = await currentValue(northStar.metric).catch(() => null);
    const pct = current != null ? Math.round((current / northStar.target) * 100) : null;
    nsForStore = { ...northStar, current, pct, label: METRICS[northStar.metric].label };
    nsBlock = `North Star: ${METRICS[northStar.metric].label} — target ${northStar.target}${northStar.deadline ? ` by ${northStar.deadline}` : ''}. Current (last 30d): ${current ?? 'unknown'}${pct != null ? ` (${pct}% of target)` : ''}.${northStar.note ? ` Note: ${northStar.note}` : ''}`;
  }

  // Study before teaching: load the house memory (proven lessons + the pitfalls
  // the auditors caught) so the Chief can't repeat past mistakes. The Chief
  // already WRITES learnings every week; now it READS them too — the loop closes.
  const learned = await playbookPromptBlock().catch(() => '');

  const userPayload = [
    learned, learned ? '' : '',
    nsBlock, '',
    directionLine, '',
    metrics.activeProducts > 0
      ? `CATALOGUE REALITY (sanity-check all money against this): the store has ${metrics.activeProducts} ACTIVE product(s) priced €${metrics.priceFloorEUR}–€${metrics.priceCeilingEUR}, average €${metrics.avgPriceEUR}. The catalogue is LIVE — do NOT call this "pre-launch", "a catalogue with no products", or claim there is nothing to sell. The cheapest product is €${metrics.priceFloorEUR}, so any order or AOV below that is NOT a real sale.`
      : `CATALOGUE REALITY: no ACTIVE products were detected. This may be genuinely pre-launch OR a data glitch — say "no active products detected, verify the catalogue" and flag it to check; do NOT assert the catalogue is empty as established fact.`,
    metrics.anomalousOrders30d > 0
      ? `⚠ DATA WARNING: ${metrics.anomalousOrders30d} order(s) in the last 30d are below the €${metrics.priceFloorEUR} price floor — treat these as test/refund/anomalous and EXCLUDE them from any "revenue" or "first sales" claim.`
      : '',
    '',
    `THIS WEEK vs LAST WEEK:`,
    `- Paid orders: ${metrics.orders.last7} (prev ${metrics.orders.prev7})`,
    `- Revenue: €${metrics.revenue.last7} (prev €${metrics.revenue.prev7}) — sanity-check against the €${metrics.priceFloorEUR} floor above before describing it.`,
    `- Human visitors (data-centre bot cities already excluded): ${metrics.humanVisitors.last7} (prev ${metrics.humanVisitors.prev7}). These exclude known crawler traffic; if this is near zero, there is essentially no real audience yet — do not infer demand from it.`,
    `- Traffic sources (30d): ${metrics.sources.map(s => `${s.source} ${s.sessions}`).join(', ') || 'none'} (note: 'direct' at this stage is mostly the founder's own network or bots, not organic demand).`,
    `- Top products (30d): ${metrics.topProducts.map(p => `${p.name} ×${p.units}`).join(', ') || 'no sales yet'}`,
    '',
    `COMPETITOR FIELD (${competitors.length} brands you compete with — reason about the MARKET, not one brand): ${competitors.slice(0, 60).map(c => c.name).join(', ')}${competitors.length > 60 ? `, +${competitors.length - 60} more` : ''}.`,
    '',
    metrics.search
      ? `GOOGLE SEARCH (real internet demand, 28d): ${metrics.search.totals.clicks} clicks, ${metrics.search.totals.impressions} impressions, avg position ${Math.round(metrics.search.totals.position)}. Queries you appear for: ${metrics.search.topQueries.map(q => `"${q.key}"(${q.impressions}imp)`).join(', ') || 'none yet'}. Opportunities (impressions but weak position): ${metrics.search.opportunities.filter(o => o.position > 8).map(o => `"${o.query}" pos ${o.position}`).slice(0, 6).join(', ') || 'none'}.`
      : 'GOOGLE SEARCH: not connected / no data yet.',
    metrics.search?.countries?.length
      ? `GEOGRAPHIC FOOTHOLDS (where Google actually shows the shop — ISO codes; the brand ships worldwide): ${metrics.search.countries.map(c => `${String(c.country).toUpperCase()} ${c.impressions}imp/${c.clicks}clk`).join(', ')}. Note any market warming up, and any with impressions but ~no clicks (seen but not chosen there).`
      : '',
    '',
    require('./clickstream').clickstreamPromptLine(metrics.clickstream) || 'FIRST-PARTY CLICKSTREAM: no on-site behaviour captured yet.',
    '',
    `CONTENT OUTCOMES (did past articles work?): ${outcomes.length ? outcomes.map(o => `"${o.title}" — ${o.ageDays ?? '?'}d old, ${o.impressions} impressions, ${o.verdict}`).join(' | ') : 'no published articles yet'}`,
    '',
    `RECENT ENGINE ACTIVITY: ${recentActions.map(a => `${a.agent}:${a.type}`).join(', ')}`,
    '',
    `HERMES' SEO READ (the search-performance strategist's latest plays — what we already rank for and how to win more clicks): ${recentActions.filter(a => a.agent === 'hermes').map(a => a.title).slice(0, 4).join(' | ') || 'nothing mapped yet'}`,
    '',
    clerks ? `CLERKS' VERDICT (the Logic Clerk audited the agents' output as a chain; the Reasoning Clerk fact-checked it against live web evidence): ${clerks.line} Take this seriously — if the chain has broken links or claims were flagged as unproven, do NOT build a confident story on the flagged material; treat it as suspect.` : '',
    '',
    `COMPETITOR / STOREFRONT INTEL (for buildIdeas): ${ideas.length ? ideas.map(i => `[${i.agent}] ${i.title} — ${i.detail}`).join(' || ') : 'none gathered yet'}`,
    '',
    `Write the brief JSON now.`,
  ].join('\n');

  // The AI call, hardened: a single bounded attempt (40s) so it can't hang or
  // stack into an infrastructure timeout. On ANY failure — slow model, flaky
  // network, bad JSON — we write a deterministic, data-honest brief instead, so
  // the founder ALWAYS gets a fresh brief that supersedes the stale one.
  let parsed = null;
  try {
    const res = await client.chat.completions.create(
      {
        model: MODEL,
        messages: [{ role: 'system', content: BRIEF_SYSTEM }, { role: 'user', content: userPayload }],
        temperature: 0.4,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
      },
      { timeout: 40000, maxRetries: 1 },
    );
    parsed = JSON.parse(res.choices[0]?.message?.content || '{}');
    if (!parsed || !parsed.headline) parsed = null; // empty/garbage → fallback
  } catch (err) {
    console.warn(`[chief] brief AI failed, using deterministic fallback: ${err.message}`);
  }
  const usedFallback = !parsed;
  if (!parsed) parsed = fallbackBriefFields(metrics, nsForStore, competitors);

  // Coerce to the exact schema shape so a mis-shaped AI response can't
  // cast-error on save. If save still somehow fails, fall back to the
  // deterministic fields and try once more — the brief MUST be written.
  const doc = {
    headline: asStr(parsed.headline) || 'Weekly brief',
    northStar: nsForStore,
    clerksVerdict: clerks?.line || '',
    progress: asStr(parsed.progress),
    whatChanged: asStr(parsed.whatChanged),
    whatsWorking: asStr(parsed.whatsWorking),
    marketRead: asStr(parsed.marketRead),
    moves: coerceMoves(parsed.moves),
    founderActions: coerceStrings(parsed.founderActions),
    buildIdeas: coerceIdeas(parsed.buildIdeas),
    metrics: { ...metrics, outcomes, usedFallback },
  };

  // GROUND-TRUTH AUDITOR — deterministic pre-publish gate. The Chief reads the
  // DB but its LLM can still over-claim; this checks the brief's words against
  // live data, flags any contradiction on the brief itself (so the human sees
  // it), and files each as a pitfall in Archivarius so the house learns not to
  // repeat it.
  try {
    const briefText = [doc.headline, doc.progress, doc.whatChanged, doc.whatsWorking, doc.marketRead].filter(Boolean).join('\n');
    const { findings } = await require('./groundTruthAuditor').auditText(briefText);
    if (findings.length) {
      const note = '⚠ GROUND-TRUTH AUDITOR: this brief contradicts live data — ' +
        findings.map(f => `claimed ${f.claim}, but ${f.truth}`).join('; ') + '. Treat with caution.';
      doc.clerksVerdict = note + (doc.clerksVerdict ? ' · ' + doc.clerksVerdict : '');
      console.warn('[chief]', note);
      const archivarius = require('./archivarius');
      for (const f of findings) {
        await archivarius.remember({
          kind: 'pitfall',
          text: `Never claim ${f.claim}: ground truth is that ${f.truth}. Check the live count/data before asserting it.`,
          detail: 'Caught by the Ground-Truth Auditor on a Chief weekly brief.',
          source: 'ground-truth-auditor',
          tags: ['data-integrity', 'chief'],
        }).catch(() => {});
      }
    }
  } catch (auditErr) {
    console.warn('[chief] ground-truth auditor skipped:', auditErr.message);
  }

  let brief;
  try {
    brief = await CEOBrief.create(doc);
  } catch (saveErr) {
    console.warn('[chief] brief save failed, retrying with safe fields:', saveErr.message);
    const fb = fallbackBriefFields(metrics, nsForStore, competitors);
    brief = await CEOBrief.create({
      headline: fb.headline, northStar: nsForStore, clerksVerdict: clerks?.line || '', progress: fb.progress,
      whatChanged: fb.whatChanged, whatsWorking: fb.whatsWorking, marketRead: fb.marketRead,
      moves: coerceMoves(fb.moves), founderActions: coerceStrings(fb.founderActions), buildIdeas: [],
      metrics: { ...metrics, usedFallback: true },
    });
  }

  // Update the shared Playbook — the distilled learnings every agent will read
  // and apply next cycle. This is the loop that makes the team adaptive: the
  // brain teaches the workers what's working, automatically, every week.
  if (Array.isArray(parsed.learnings) && parsed.learnings.length) {
    // Merge (not overwrite) so Hermes' and the clerks' running learnings survive.
    await mergeLearnings(parsed.learnings).catch(() => {});
  }

  // Drop a pinned action in the pulse feed so the brief is impossible to miss.
  await GrowthAction.create({
    agent: 'chief',
    type: 'briefing',
    title: `Weekly brief: ${brief.headline}`,
    detail: brief.progress,
    href: '/admin/growth',
    status: 'info',
    meta: { briefId: String(brief._id) },
  }).catch(() => {});

  return { brief };
}

// Weekly cadence guard for the in-process cron.
async function runChiefIfDue({ force = false } = {}) {
  const key = 'chiefOfStaffLastRun';
  const doc = await SystemState.findOne({ key }).lean();
  const last = doc?.value ? new Date(doc.value).getTime() : 0;
  if (!force && Date.now() - last < 7 * DAY) return { ran: false };
  const result = await generateBrief();
  await SystemState.findOneAndUpdate({ key }, { value: new Date().toISOString() }, { upsert: true });
  return { ran: true, ...result };
}

module.exports = {
  METRICS, getNorthStar, setNorthStar, northStarStatus,
  measure, contentOutcomes, generateBrief, runChiefIfDue,
};
