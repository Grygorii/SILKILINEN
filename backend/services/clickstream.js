'use strict';

// First-party clickstream signals, distilled for the agents' brain. The Event
// stream (page/funnel/search/click events) powers the admin Journeys view, but
// until now no agent read it. This exposes the few signals that actually change
// a marketing decision — the on-site funnel drop-off, what people SEARCH for on
// the site, and which products they CLICK — so the Chief of Staff and the
// Marketing Coordinator can reason over real first-party behaviour, not just
// orders and Search Console. Fail-soft: returns zeros if Event is empty.

const Event = require('../models/Event');
const { getFunnel } = require('./funnel');

async function getClickstreamSignals(days = 14) {
  const since = new Date(Date.now() - days * 86400000);

  const [full, searches, misses, clicks] = await Promise.all([
    // The funnel is NOT recomputed here. services/funnel.js owns it — including
    // the monotonic clamping, the segment gates and the week-over-week shift —
    // and this file used to run its own slightly different aggregation of the
    // same stages. Two funnels that could disagree is exactly the drift this
    // codebase keeps paying for, and the agents were reading the poorer one.
    getFunnel(days).catch(() => null),
    // What people search for ON the site — pure first-party demand.
    Event.aggregate([
      { $match: { createdAt: { $gte: since }, type: 'search' } },
      { $group: { _id: '$props.search_term', n: { $sum: 1 } } },
      { $match: { _id: { $nin: [null, ''] } } }, { $sort: { n: -1 } }, { $limit: 10 },
    ]).catch(() => []),
    // Searches that returned NOTHING. The least ambiguous signal in the shop:
    // someone typed exactly what they came to buy and we showed them an empty
    // page. Usually a naming problem (we sell it, under a word nobody searches)
    // before it is a stocking problem.
    Event.aggregate([
      { $match: { createdAt: { $gte: since }, type: 'search', 'props.no_results': true } },
      { $group: { _id: '$props.search_term', n: { $sum: 1 }, sessions: { $addToSet: '$sessionId' } } },
      { $match: { _id: { $nin: [null, ''] } } },
      { $project: { n: 1, people: { $size: '$sessions' } } },
      { $sort: { people: -1, n: -1 } }, { $limit: 8 },
    ]).catch(() => []),
    // Most-clicked products (interest, not just sales).
    Event.aggregate([
      { $match: { createdAt: { $gte: since }, type: 'card_click' } },
      { $group: { _id: '$props.name', n: { $sum: 1 } } },
      { $match: { _id: { $nin: [null, ''] } } }, { $sort: { n: -1 } }, { $limit: 8 },
    ]).catch(() => []),
  ]);

  const byKey = Object.fromEntries((full?.stages || []).map(s => [s.key, s.count]));
  const totalSessions = byKey.sessions || 0;
  const topSearches = searches.map(s => ({ term: s._id, count: s.n }));
  const topClicked = clicks.map(c => ({ name: c._id, count: c.n }));
  const unmetSearches = misses.map(m => ({ term: m._id, count: m.n, people: m.people }));

  return {
    days,
    totalSessions,
    funnel: {
      sessions: totalSessions,
      viewedProduct: byKey.viewedProduct || 0,
      addedToCart: byKey.addedToCart || 0,
      beganCheckout: byKey.reachedCheckout || 0,
      purchased: byKey.purchased || 0,
    },
    // The rich view — biggest leak, who it is, which products, what moved.
    // Kept whole so prompts can quote specifics rather than just totals.
    full,
    topSearches,
    topClicked,
    unmetSearches,
    hasData: totalSessions > 0 || topSearches.length > 0 || topClicked.length > 0,
  };
}

// A compact brief for an LLM prompt. Empty string when there is no first-party
// data yet, so prompts stay clean pre-traction.
//
// This used to be totals only — sessions, views, adds, purchases — which let an
// agent say "improve add-to-cart" and nothing sharper. It now carries the same
// specifics the founder's panel shows: which step leaks worst, which device or
// source underperforms, which products lose their viewers, and what moved since
// the previous window. Every one of those is already sample-gated in
// services/funnel.js, so an agent can quote them without inventing a pattern
// from three sessions.
function clickstreamPromptLine(cs) {
  if (!cs || !cs.hasData) return '';
  const f = cs.funnel;
  const drop = f.viewedProduct > 0 ? Math.round((f.addedToCart / f.viewedProduct) * 100) : 0;
  const searches = cs.topSearches.length ? cs.topSearches.map(s => `"${s.term}"(${s.count})`).join(', ') : 'none';
  const clicked = cs.topClicked.length ? cs.topClicked.map(c => `${c.name}(${c.count})`).join(', ') : 'none';

  const parts = [
    `FIRST-PARTY CLICKSTREAM (last ${cs.days}d, our own site): ${f.sessions} sessions → ${f.viewedProduct} viewed a product → ${f.addedToCart} added to cart (${drop}% of viewers) → ${f.beganCheckout} began checkout → ${f.purchased} purchased.`,
  ];

  const full = cs.full;
  if (full?.biggestLeak) {
    parts.push(`WORST STEP: "${full.biggestLeak.label}" loses ${full.biggestLeak.lost} people (${100 - full.biggestLeak.rate}% of those who reach it).`);
  }
  const d = full?.diagnosis;
  if (d?.device) {
    parts.push(`By device: ${d.device.segment} converts ${d.device.rate}% there vs ${d.device.bestRate}% on ${d.device.bestSegment}.`);
  }
  if (d?.source) {
    parts.push(`By source: ${d.source.segment} converts ${d.source.rate}% vs ${d.source.bestRate}% from ${d.source.bestSegment}.`);
  }
  if (d?.products?.length) {
    parts.push(`Products losing most viewers: ${d.products.map(p => `${p.name} (${p.added}/${p.viewed} added)`).join(', ')}.`);
  }
  if (full?.biggestShift) {
    const sh = full.biggestShift;
    parts.push(`CHANGE vs the previous ${cs.days}d: "${sh.label}" went ${sh.ratePrev}% → ${sh.rateNow}% (${sh.delta > 0 ? '+' : ''}${sh.delta} pts).`);
  }

  parts.push(`On-site SEARCHES (real demand, what visitors typed): ${searches}.`);
  parts.push(`Most-CLICKED products (interest): ${clicked}.`);
  if (cs.unmetSearches?.length) {
    parts.push(`SEARCHED BUT FOUND NOTHING (demand we did not meet): ${cs.unmetSearches.map(u => `"${u.term}" (${u.people} ${u.people === 1 ? 'person' : 'people'})`).join(', ')}. Check whether we sell it under a different name before treating it as a gap in the range.`);
  }
  // Anything absent above was withheld by a sample gate, not by absence of a
  // problem — say so, or an agent will read silence as "all fine".
  parts.push('Any breakdown not listed was withheld for insufficient sample, not because it is healthy.');
  return parts.join(' ');
}

module.exports = { getClickstreamSignals, clickstreamPromptLine };
