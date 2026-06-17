'use strict';

// First-party clickstream signals, distilled for the agents' brain. The Event
// stream (page/funnel/search/click events) powers the admin Journeys view, but
// until now no agent read it. This exposes the few signals that actually change
// a marketing decision — the on-site funnel drop-off, what people SEARCH for on
// the site, and which products they CLICK — so the Chief of Staff and the
// Marketing Coordinator can reason over real first-party behaviour, not just
// orders and Search Console. Fail-soft: returns zeros if Event is empty.

const Event = require('../models/Event');
const Visit = require('../models/Visit');

async function getClickstreamSignals(days = 14) {
  const since = new Date(Date.now() - days * 86400000);
  const STAGES = ['view_item', 'add_to_cart', 'begin_checkout', 'purchase'];

  const [sessionAgg, funnelAgg, searches, clicks] = await Promise.all([
    Visit.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$sessionId' } }, { $count: 'n' },
    ]).catch(() => []),
    // Distinct sessions per funnel stage (not raw counts).
    Event.aggregate([
      { $match: { createdAt: { $gte: since }, type: { $in: STAGES } } },
      { $group: { _id: { t: '$type', s: '$sessionId' } } },
      { $group: { _id: '$_id.t', n: { $sum: 1 } } },
    ]).catch(() => []),
    // What people search for ON the site — pure first-party demand.
    Event.aggregate([
      { $match: { createdAt: { $gte: since }, type: 'search' } },
      { $group: { _id: '$props.search_term', n: { $sum: 1 } } },
      { $match: { _id: { $nin: [null, ''] } } }, { $sort: { n: -1 } }, { $limit: 10 },
    ]).catch(() => []),
    // Most-clicked products (interest, not just sales).
    Event.aggregate([
      { $match: { createdAt: { $gte: since }, type: 'card_click' } },
      { $group: { _id: '$props.name', n: { $sum: 1 } } },
      { $match: { _id: { $nin: [null, ''] } } }, { $sort: { n: -1 } }, { $limit: 8 },
    ]).catch(() => []),
  ]);

  const totalSessions = sessionAgg[0]?.n || 0;
  const stage = Object.fromEntries(funnelAgg.map(s => [s._id, s.n]));
  const topSearches = searches.map(s => ({ term: s._id, count: s.n }));
  const topClicked = clicks.map(c => ({ name: c._id, count: c.n }));

  return {
    days,
    totalSessions,
    funnel: {
      sessions: totalSessions,
      viewedProduct: stage.view_item || 0,
      addedToCart: stage.add_to_cart || 0,
      beganCheckout: stage.begin_checkout || 0,
      purchased: stage.purchase || 0,
    },
    topSearches,
    topClicked,
    hasData: totalSessions > 0 || topSearches.length > 0 || topClicked.length > 0,
  };
}

// A compact one-paragraph brief line for an LLM prompt. Empty string when there
// is no first-party data yet, so prompts stay clean pre-traction.
function clickstreamPromptLine(cs) {
  if (!cs || !cs.hasData) return '';
  const f = cs.funnel;
  const drop = f.viewedProduct > 0 ? Math.round((f.addedToCart / f.viewedProduct) * 100) : 0;
  const searches = cs.topSearches.length ? cs.topSearches.map(s => `"${s.term}"(${s.count})`).join(', ') : 'none';
  const clicked = cs.topClicked.length ? cs.topClicked.map(c => `${c.name}(${c.count})`).join(', ') : 'none';
  return `FIRST-PARTY CLICKSTREAM (last ${cs.days}d, our own site): ${f.sessions} sessions → ${f.viewedProduct} viewed a product → ${f.addedToCart} added to cart (${drop}% of viewers) → ${f.beganCheckout} began checkout → ${f.purchased} purchased. On-site SEARCHES (real demand, what visitors typed): ${searches}. Most-CLICKED products (interest): ${clicked}.`;
}

module.exports = { getClickstreamSignals, clickstreamPromptLine };
