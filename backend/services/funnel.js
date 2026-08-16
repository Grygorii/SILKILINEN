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

  return {
    days,
    stages,
    biggestLeak,
    overallConversion: overall,
    // Pre-traction the honest answer is "not enough data yet", not a chart of
    // zeros that invites reading noise as signal.
    hasData: sessions > 0,
  };
}

module.exports = { getFunnel, STAGES };
