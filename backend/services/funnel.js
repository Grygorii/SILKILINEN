'use strict';

// The founder-facing funnel.
//
// services/clickstream.js already counted distinct sessions per stage — but it
// was built to feed the AGENTS' prompts (see its header). The result was that
// the Chief of Staff could reason about where customers drop and the founder
// could not see it. This turns the same signal into a decision.
//
// The numbers are the easy part. What matters is which step leaks worst and
// WHICH SCREEN fixes it, so the answer to "where do I push?" is a link, not a
// chart to interpret.

const Event = require('../models/Event');
const Visit = require('../models/Visit');
const Product = require('../models/Product');

// Ordered funnel. `fix` is the admin screen that plausibly moves THIS step —
// the whole point of the cockpit. `why` explains the leak in plain language.
const STAGES = [
  {
    key: 'sessions', label: 'Visited the site', event: null,
    why: 'People arrive but never open a product — the entrance is not selling the idea.',
    fix: { label: 'Review the homepage', href: '/admin/atelier' },
  },
  {
    key: 'viewedProduct', label: 'Opened a product', event: 'view_item',
    why: 'They look but do not add — photography, price framing, or sizing confidence.',
    fix: { label: 'Watch a session', href: '/admin/journeys?stage=view_item' },
  },
  {
    key: 'addedToCart', label: 'Added to cart', event: 'add_to_cart',
    why: 'Carts are filled and abandoned before checkout — usually shipping cost or hesitation.',
    fix: { label: 'Watch a session', href: '/admin/journeys?stage=add_to_cart' },
  },
  {
    key: 'reachedCheckout', label: 'Reached checkout', event: 'begin_checkout',
    why: 'They open checkout but never start paying — friction or trust at the final step.',
    // Carries the stage so Session Replay opens on the sessions that stopped
    // at exactly this step, rather than a generic list.
    fix: { label: 'Watch a session', href: '/admin/journeys?stage=begin_checkout' },
  },
  {
    key: 'startedPayment', label: 'Started payment', event: 'reached_payment',
    why: 'They committed to pay and still did not finish — a payment or validation failure.',
    fix: { label: 'Check orders', href: '/admin/orders' },
  },
  {
    key: 'purchased', label: 'Paid', event: 'purchase',
    why: '',
    fix: null,
  },
];

// Stage counts for one time window. Extracted so the same maths can run over
// the previous window and the two can be compared — a funnel that can't see
// last week can only ever tell you the level, never the change.
async function stageCounts(since, until) {
  const eventTypes = STAGES.filter(s => s.event).map(s => s.event);
  const range = until ? { $gte: since, $lt: until } : { $gte: since };

  const [sessionAgg, stageAgg] = await Promise.all([
    Visit.aggregate([
      { $match: { createdAt: range } },
      { $group: { _id: '$sessionId' } },
      { $count: 'n' },
    ]).catch(() => []),
    Event.aggregate([
      { $match: { createdAt: range, type: { $in: eventTypes } } },
      { $group: { _id: { t: '$type', s: '$sessionId' } } },
      { $group: { _id: '$_id.t', n: { $sum: 1 } } },
    ]).catch(() => []),
  ]);

  const counts = Object.fromEntries(stageAgg.map(s => [s._id, s.n]));
  const sessions = sessionAgg[0]?.n || 0;

  let prev = null;
  return STAGES.map(s => {
    const raw = s.event ? (counts[s.event] || 0) : sessions;
    // A later stage can exceed an earlier one when a visitor's session spans the
    // window boundary (they added to cart yesterday, paid today). Clamping keeps
    // the funnel monotonic so a "drop" is never negative and never misleads.
    const value = prev === null ? raw : Math.min(raw, prev);
    const lost = prev === null ? 0 : prev - value;
    const rate = prev ? Math.round((value / prev) * 100) : 100;
    const enteredFrom = prev === null ? value : prev;
    prev = value;
    return { key: s.key, label: s.label, count: value, lost, rate, enteredFrom, why: s.why, fix: s.fix };
  });
}

// Short-lived memo. getFunnel runs ~10 aggregations over Event and Visit, and it
// now has five callers — the dashboard panel (which auto-refreshes), the
// clickstream brief feeding two agents, the analyst's tool and the advisor
// (which itself runs on dashboard load and in the weekly digest). Without this,
// one dashboard render could fan out to fifty aggregations over the same rows.
//
// 60s is chosen so the panel's own refresh cycle and the agents that run
// alongside it share one computation, while the number on screen is never more
// than a minute stale — this is a trend panel, not a live order feed.
const CACHE_MS = 60 * 1000;
const cache = new Map();

/**
 * Funnel over the last `days`, counted in DISTINCT SESSIONS per stage (not raw
 * events, so one person reloading a product page five times is still one).
 *
 * Returns stages in order, each with its count, the share of the previous step
 * that survived, and how many were lost — plus `biggestLeak`, the step that
 * loses the most PEOPLE. Deliberately absolute, not percentage: a 90% drop on a
 * step 4 people reach is noise, while a 40% drop on 500 is the whole business.
 */
async function getFunnel(days = 14) {
  const hit = cache.get(days);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const value = await computeFunnel(days);
  cache.set(days, { at: Date.now(), value });
  return value;
}

async function computeFunnel(days) {
  const since = new Date(Date.now() - days * 86400000);
  const prevSince = new Date(Date.now() - days * 2 * 86400000);

  const [stages, prevStages] = await Promise.all([
    stageCounts(since),
    stageCounts(prevSince, since),
  ]);
  const sessions = stages[0].count;

  // The leak worth acting on: most people lost, ignoring the final stage (which
  // has nowhere to leak to).
  const leakable = stages.slice(1).filter(s => s.lost > 0);
  const biggestLeak = leakable.length
    ? leakable.reduce((a, b) => (b.lost > a.lost ? b : a))
    : null;

  const overall = sessions ? Math.round((stages[stages.length - 1].count / sessions) * 1000) / 10 : 0;

  const diagnosis = await diagnoseLeak(stages, biggestLeak, since);
  const shifts = detectShifts(stages, prevStages);
  const blindSpots = await findBlindSpots(stages);

  return {
    days,
    stages,
    biggestLeak,
    diagnosis,
    shifts,
    biggestShift: shifts.length ? shifts[0] : null,
    blindSpots,
    overallConversion: overall,
    // Pre-traction the honest answer is "not enough data yet", not a chart of
    // zeros that invites reading noise as signal.
    hasData: sessions > 0,
  };
}

/**
 * Stages we are not actually recording.
 *
 * A stage with zero sessions is normally customer behaviour: nobody got that
 * far. But it reads identically to a stage whose event is not wired up at all —
 * and that failure is real, not hypothetical. add_to_cart carried no productId
 * for months, so the per-product analysis matched nothing and rendered as "no
 * products are leaking". search was never fired at all while the agents were
 * being told what people searched for.
 *
 * The tell: an event type with NO rows in the entire collection, while an
 * earlier stage has traffic. Real customer drop-off leaves at least a trickle
 * over the life of the store; a missing instrument leaves nothing, ever.
 *
 * A funnel that cannot tell "nobody did this" from "we never recorded this"
 * will eventually report a catastrophe that is really a missing line of code —
 * or, worse, stay quiet about one.
 */
async function findBlindSpots(stages) {
  const upstreamHasTraffic = stages[0].count > 0;
  if (!upstreamHasTraffic) return []; // pre-traction: everything is legitimately empty

  const out = [];
  for (let i = 1; i < STAGES.length; i++) {
    if (stages[i].count > 0) continue;
    // Only suspicious if people actually reached the step before it.
    if (stages[i - 1].count === 0) continue;
    const everRecorded = await Event.exists({ type: STAGES[i].event }).catch(() => true);
    if (!everRecorded) {
      out.push({
        key: stages[i].key,
        label: stages[i].label,
        event: STAGES[i].event,
        note: `No "${STAGES[i].event}" event has ever been recorded, while ${stages[i - 1].count} sessions reached the step before it. This stage is probably not instrumented — treat the drop as unknown, not as zero.`,
      });
    }
  }
  return out;
}

// Minimum sessions before a segment is allowed to be named. Below this, one
// person's behaviour swings the rate to 0% or 100% and the "insight" is noise
// dressed as a finding — the failure mode this panel exists to avoid.
const MIN_SEGMENT = 8;

// Distinct sessions per segment value, for one funnel step.
// `event === null` means the entrance stage, which is counted from Visit.
async function sessionsBySegment(event, field, since) {
  const Model = event ? Event : Visit;
  const match = event
    ? { createdAt: { $gte: since }, type: event }
    : { createdAt: { $gte: since } };
  const rows = await Model.aggregate([
    { $match: match },
    { $group: { _id: { seg: `$${field}`, s: '$sessionId' } } },
    { $group: { _id: '$_id.seg', n: { $sum: 1 } } },
  ]).catch(() => []);
  return Object.fromEntries(rows.map(r => [r._id || 'unknown', r.n]));
}

// Which segment converts WORST across the leaking step. Returns null rather
// than a guess when nothing clears MIN_SEGMENT — "not enough data" is a real
// answer and the panel says it.
async function worstSegment(prevEvent, curEvent, field, since) {
  const [before, after] = await Promise.all([
    sessionsBySegment(prevEvent, field, since),
    sessionsBySegment(curEvent, field, since),
  ]);
  const rows = Object.entries(before)
    .filter(([, n]) => n >= MIN_SEGMENT)
    .map(([seg, n]) => {
      const kept = Math.min(after[seg] || 0, n);
      return { segment: seg, of: n, kept, lost: n - kept, rate: Math.round((kept / n) * 100) };
    });
  if (rows.length < 2) return null; // nothing to compare against
  const worst = rows.reduce((a, b) => (b.rate < a.rate ? b : a));
  const best = rows.reduce((a, b) => (b.rate > a.rate ? b : a));
  // Only worth reporting when segments actually differ; a uniform drop is a
  // whole-funnel problem, not a segment one.
  if (worst.segment === best.segment || best.rate - worst.rate < 15) return null;
  return { ...worst, bestSegment: best.segment, bestRate: best.rate };
}

// Products people OPEN but don't add. The per-product version of the
// view_item -> add_to_cart leak, which is the only step where naming the
// individual product is actionable.
async function leakiestProducts(since, limit = 3) {
  const rows = await Event.aggregate([
    { $match: { createdAt: { $gte: since }, type: { $in: ['view_item', 'add_to_cart'] }, productId: { $ne: null } } },
    { $group: { _id: { p: '$productId', t: '$type', s: '$sessionId' } } },
    { $group: { _id: { p: '$_id.p', t: '$_id.t' }, n: { $sum: 1 } } },
  ]).catch(() => []);

  const byProduct = new Map();
  for (const r of rows) {
    const id = String(r._id.p);
    const e = byProduct.get(id) || { viewed: 0, added: 0 };
    if (r._id.t === 'view_item') e.viewed = r.n; else e.added = r.n;
    byProduct.set(id, e);
  }

  const ranked = [...byProduct.entries()]
    .filter(([, e]) => e.viewed >= MIN_SEGMENT)
    .map(([id, e]) => ({ id, viewed: e.viewed, added: Math.min(e.added, e.viewed) }))
    .map(p => ({ ...p, lost: p.viewed - p.added, rate: Math.round((p.added / p.viewed) * 100) }))
    .sort((a, b) => b.lost - a.lost)
    .slice(0, limit);
  if (!ranked.length) return [];

  const products = await Product.find({ _id: { $in: ranked.map(r => r.id) } })
    .select('_id name slug').lean().catch(() => []);
  const names = Object.fromEntries(products.map(p => [String(p._id), p.name]));
  return ranked
    .filter(r => names[r.id])
    .map(r => ({ name: names[r.id], viewed: r.viewed, added: r.added, lost: r.lost, rate: r.rate }));
}

/**
 * Name the specific thing behind the biggest leak, instead of the category.
 *
 * "People drop at add-to-cart" is a category. "Mobile visitors add at 12% while
 * desktop adds at 41%, and the Sky Blue nightshirt loses 23 of them" is a
 * decision. Every claim here is gated on MIN_SEGMENT so it can't invent a
 * pattern out of three sessions.
 */
async function diagnoseLeak(stages, biggestLeak, since) {
  if (!biggestLeak) return null;
  const idx = stages.findIndex(s => s.key === biggestLeak.key);
  if (idx < 1) return null;
  const curEvent = STAGES[idx].event;
  const prevEvent = STAGES[idx - 1].event;

  const [device, source, products] = await Promise.all([
    worstSegment(prevEvent, curEvent, 'device', since),
    worstSegment(prevEvent, curEvent, 'source', since),
    // Per-product only makes sense for the view -> add step.
    STAGES[idx].key === 'addedToCart' ? leakiestProducts(since) : Promise.resolve([]),
  ]);

  return { device, source, products, minSegment: MIN_SEGMENT };
}

// How many points a step's conversion rate must move week-over-week before it
// is worth interrupting the founder. Rates on small samples wander on their own,
// so a low threshold here would cry wolf every week and the panel would stop
// being read — the expensive failure, not a missed alert.
const SHIFT_POINTS = 10;

/**
 * What CHANGED, comparing this window against the one before it.
 *
 * A funnel that only shows the level tells you where you are; you have to
 * remember last week yourself to know if you are sliding. This is the part that
 * taps you on the shoulder.
 *
 * Both windows must have real volume entering the step (MIN_SEGMENT), because
 * "conversion fell from 100% to 50%" across two visitors is arithmetic, not news.
 * Sorted worst drop first, so the caller can take [0] as the headline.
 */
function detectShifts(stages, prevStages) {
  const before = Object.fromEntries(prevStages.map(s => [s.key, s]));
  return stages
    .slice(1)
    .map(s => {
      const was = before[s.key];
      if (!was) return null;
      if (s.enteredFrom < MIN_SEGMENT || was.enteredFrom < MIN_SEGMENT) return null;
      const delta = s.rate - was.rate;
      if (Math.abs(delta) < SHIFT_POINTS) return null;
      return {
        key: s.key,
        label: s.label,
        rateNow: s.rate,
        ratePrev: was.rate,
        delta,
        direction: delta < 0 ? 'down' : 'up',
        fix: s.fix,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.delta - b.delta);
}

module.exports = { getFunnel, STAGES, detectShifts, MIN_SEGMENT, SHIFT_POINTS };
