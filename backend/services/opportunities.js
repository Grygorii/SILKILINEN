'use strict';

// The Growth Engine's opportunity list: every real search query, joined against
// what the shop actually stocks, turned into something to do.
//
// The admin had the two halves and never put them together. Search Console knew
// what people search for; the catalogue knew what exists and how much is left;
// the founder did the join by hand, weekly, and mostly did not. The rule lives in
// utils/demandFit.js — this only fetches.
//
// Matching uses buildSearchFilter, the SAME rule the storefront's search box
// uses, so "we have nothing for this query" means the same thing here as it does
// to a shopper typing it. Anything else and the list would claim gaps that are
// really just search misses (the bug Wave 7 fixed).

const Product = require('../models/Product');
const StockNotification = require('../models/StockNotification');
const Order = require('../models/Order');
const { buildSearchFilter } = require('../utils/productSearch');
const { classifyDemand, rankProposals } = require('../utils/demandFit');
const gsc = require('./searchConsole');

// Enough to be a decision; not so many that the list stops being read.
const MAX_PROPOSALS = 8;

/**
 * @returns {Promise<{connected: boolean, proposals: Array, queriesChecked: number}>}
 *   Never throws: a Search Console outage returns connected:false rather than
 *   an empty list, because "no opportunities" and "we could not look" must not
 *   read the same on a dashboard.
 */
async function findOpportunities({ days = 28 } = {}) {
  // Search Console is OPTIONAL here. The shop's own search box is first-party
  // demand and does not depend on Google being connected — returning early on a
  // missing GSC connection would have thrown away the stronger of the two
  // signals because the weaker one was unavailable.
  const connected = await gsc.isConnected().catch(() => false);
  const queries = connected ? await gsc.getQueryOpportunities(days).catch(() => []) : [];

  // Units sold per product, and whether the shop sells ANYTHING.
  //
  // Without this, "ranks well and sells" and "ranks well and has never sold"
  // were the same row to the rule, and it called both of them fine. They are
  // opposite situations: one wants more stock, the other wants a better page.
  //
  // The shop-wide flag is the guard. With no orders at all, every product has
  // sold nothing — blaming each product page for that would bury the real
  // problem (nobody is arriving) under a dozen false diagnoses.
  const SOLD_STATUSES = ['paid', 'processing', 'shipped', 'delivered'];
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const salesRows = await Order.aggregate([
    { $match: { status: { $in: SOLD_STATUSES }, createdAt: { $gte: since } } },
    { $unwind: '$items' },
    { $match: { 'items.productId': { $ne: null } } },
    { $group: { _id: '$items.productId', units: { $sum: '$items.quantity' } } },
  ]).catch(() => []);
  const soldById = new Map(salesRows.map(r => [String(r._id), Number(r.units) || 0]));
  const shopSells = salesRows.length > 0;

  // On-site zero-result searches, folded into the SAME list. They were surfaced
  // in their own advisor line, saying a similar thing in a different place —
  // which is how two lists end up disagreeing about what to do. clickstream
  // already re-verifies each one against the live catalogue (unmetSearches means
  // "found nothing then AND now"), so these arrive pre-checked.
  const cs = await require('./clickstream').getClickstreamSignals(days).catch(() => null);
  const siteSearches = (cs?.unmetSearches || []).map(u => ({
    query: u.term,
    // `people`, not raw searches: one person retrying four times is one person
    // wanting something, and counting the retries would inflate the evidence.
    impressions: u.people,
    clicks: 0,
    position: 0,
    source: 'site',
  }));

  const proposals = [];
  for (const q of [...queries, ...siteSearches]) {
    const filter = buildSearchFilter(q.query);
    // A blank query cannot be matched; treat it as unmatchable rather than
    // letting a null filter select the whole catalogue.
    const matches = filter
      ? await Product.find({ status: { $in: ['active', 'sold_out'] }, ...filter })
          .select('_id name totalStock inStock status slug')
          .limit(3)
          .lean()
          .catch(() => [])
      : [];
    // Attach the waitlist to an out-of-stock match. This is the shop's strongest
    // signal — a named person who asked to be told the moment it returns — and it
    // sat in its own table, reachable only by the hourly restock sweep. A
    // "restock this" proposal that cannot see it is arguing from searches alone
    // when it could be arguing from agreed sales.
    const enriched = await Promise.all(matches.map(async m => {
      const sold = soldById.get(String(m._id)) || 0;
      const stock = Number(m.totalStock) || 0;
      if (stock > 0) return { ...m, sold };
      const waiting = await StockNotification.countDocuments({ product: m._id, notifiedAt: null })
        .catch(() => 0);
      return { ...m, sold, waiting };
    }));

    const proposal = classifyDemand(q, enriched, { shopSells });
    if (proposal) proposals.push(proposal);
  }

  return {
    // Reported so the panel can distinguish "Google is not connected" from
    // "nothing to act on" — they are different states and must not read alike.
    connected,
    queriesChecked: queries.length + siteSearches.length,
    proposals: rankProposals(proposals).slice(0, MAX_PROPOSALS),
  };
}

module.exports = { findOpportunities, MAX_PROPOSALS };
