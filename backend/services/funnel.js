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
    fix: { label: 'Check product pages', href: '/admin/products' },
  },
  {
    key: 'addedToCart', label: 'Added to cart', event: 'add_to_cart',
    why: 'Carts are filled and abandoned before checkout — usually shipping cost or hesitation.',
    fix: { label: 'Shipping & offers', href: '/admin/settings/business' },
  },
  {
    key: 'reachedCheckout', label: 'Reached checkout', event: 'begin_checkout',
    why: 'They open checkout but never start paying — friction or trust at the final step.',
    fix: { label: 'Watch a session', href: '/admin/journeys' },
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
  const since = new Date(Date.now() - days * 86400000);
  const eventTypes = STAGES.filter(s => s.event).map(s => s.event);

  const [sessionAgg, stageAgg] = await Promise.all([
    Visit.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$sessionId' } },
      { $count: 'n' },
    ]).catch(() => []),
    Event.aggregate([
      { $match: { createdAt: { $gte: since }, type: { $in: eventTypes } } },
      { $group: { _id: { t: '$type', s: '$sessionId' } } },
      { $group: { _id: '$_id.t', n: { $sum: 1 } } },
    ]).catch(() => []),
  ]);

  const counts = Object.fromEntries(stageAgg.map(s => [s._id, s.n]));
  const sessions = sessionAgg[0]?.n || 0;

  let prev = null;
  const stages = STAGES.map(s => {
    const count = s.event ? (counts[s.event] || 0) : sessions;
    // A later stage can exceed an earlier one when a visitor's session spans the
    // window boundary (they added to cart yesterday, paid today). Clamping keeps
    // the funnel monotonic so a "drop" is never negative and never misleads.
    const value = prev === null ? count : Math.min(count, prev);
    const lost = prev === null ? 0 : prev - value;
    const rate = prev ? Math.round((value / prev) * 100) : 100;
    prev = value;
    return { key: s.key, label: s.label, count: value, lost, rate, why: s.why, fix: s.fix };
  });

  // The leak worth acting on: most people lost, ignoring the final stage (which
  // has nowhere to leak to).
  const leakable = stages.slice(1).filter(s => s.lost > 0);
  const biggestLeak = leakable.length
    ? leakable.reduce((a, b) => (b.lost > a.lost ? b : a))
    : null;

  const overall = sessions ? Math.round((stages[stages.length - 1].count / sessions) * 1000) / 10 : 0;

  const diagnosis = await diagnoseLeak(stages, biggestLeak, since);

  return {
    days,
    stages,
    biggestLeak,
    diagnosis,
    overallConversion: overall,
    // Pre-traction the honest answer is "not enough data yet", not a chart of
    // zeros that invites reading noise as signal.
    hasData: sessions > 0,
  };
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

module.exports = { getFunnel, STAGES };
