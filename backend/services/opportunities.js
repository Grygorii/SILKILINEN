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
  if (!(await gsc.isConnected().catch(() => false))) {
    return { connected: false, proposals: [], queriesChecked: 0 };
  }

  const queries = await gsc.getQueryOpportunities(days).catch(() => []);
  if (!queries.length) return { connected: true, proposals: [], queriesChecked: 0 };

  const proposals = [];
  for (const q of queries) {
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
      const stock = Number(m.totalStock) || 0;
      if (stock > 0) return m;
      const waiting = await StockNotification.countDocuments({ product: m._id, notifiedAt: null })
        .catch(() => 0);
      return { ...m, waiting };
    }));

    const proposal = classifyDemand(q, enriched);
    if (proposal) proposals.push(proposal);
  }

  return {
    connected: true,
    queriesChecked: queries.length,
    proposals: rankProposals(proposals).slice(0, MAX_PROPOSALS),
  };
}

module.exports = { findOpportunities, MAX_PROPOSALS };
