'use strict';

// What to DO about a search query, given what the shop actually stocks.
//
// The shop has had Search Console data for a while and the admin could only
// display it: queries, impressions, positions, ten country tiles. Reading a
// number is not a decision, and the founder was left to join "black bikini
// briefs, 8 impressions, position 8" against the catalogue and the stock levels
// in their head, every week, for every query.
//
// This is that join, as a rule. Each query becomes one of five proposals, and
// the whole point is that they demand OPPOSITE actions — the same "8 impressions,
// no clicks" means buy stock, rewrite a title, or do nothing at all depending on
// what is behind it:
//
//   range   — real searches, nothing in the catalogue matches. Stock it, or we
//             sell it under a name nobody searches for.
//   restock — a matching product exists and is OUT OF STOCK. The demand is
//             proven and the sale is impossible; nothing else on the list is
//             worth more than fixing that.
//   depth   — matching product, ranks well, nearly out. Buy more before the
//             ranking is spent on an empty shelf.
//   rank    — matching product, past page one. Google agrees the page answers
//             the query; almost nobody scrolls that far.
//   title   — matching product, page one, impressions, no clicks. The listing is
//             seen and not chosen: that is the title's job.
//
// Deliberately silent when a query is simply working (page one, getting clicks),
// and when the sample is too thin to carry a decision. A weekly list that always
// finds five things to do is a list nobody reads.

// Below this a query is one person's curiosity, not demand.
const MIN_IMPRESSIONS = 5;
// Google's first page; past it, click-through collapses toward zero.
const PAGE_ONE = 10;
// "Nearly gone" for a boutique that stocks in small runs.
const LOW_STOCK = 3;

/**
 * @param {object} q       {query, impressions, clicks, position}
 * @param {Array}  matches products matching the query (name, totalStock, status)
 * @returns {object|null}  a proposal, or null when there is nothing worth saying
 */
function classifyDemand(q, matches = []) {
  const query = String(q?.query || '').trim();
  const impressions = Number(q?.impressions) || 0;
  const clicks = Number(q?.clicks) || 0;
  const position = Number(q?.position) || 0;
  if (!query || impressions < MIN_IMPRESSIONS) return null;

  const base = { query, impressions, clicks, position };
  const best = matches && matches.length ? matches[0] : null;

  if (!best) {
    return {
      ...base, kind: 'range', product: null,
      headline: `${impressions} searches for "${query}" and nothing in the shop matches`,
      why: `Google is showing the shop for this and finding nothing to offer. Either the range has a gap here, or we sell it under a word nobody searches for.`,
      action: `Search "${query}" in Products. If something IS effectively this, put those words in its title or colour name — that is free. If not, it is a stocking decision with ${impressions} searches of evidence behind it.`,
    };
  }

  const stock = Number(best.totalStock) || 0;
  const product = { name: best.name, stock, status: best.status || 'active' };

  if (stock <= 0) {
    return {
      ...base, kind: 'restock', product,
      headline: `"${best.name}" is out of stock and ${impressions} people searched for it`,
      why: `The demand is proven and the sale is impossible. Ranking work on this query pays for nothing until there is something to sell.`,
      action: `Restock "${best.name}", or set its stock if it has already arrived. Anyone on the waitlist is emailed automatically within the hour.`,
    };
  }

  if (position > PAGE_ONE) {
    return {
      ...base, kind: 'rank', product,
      headline: `"${query}" sits at position ${position} — page two — and we do sell it`,
      why: `Google already accepts that "${best.name}" answers this query, and almost nobody scrolls to position ${Math.round(position)}. ${impressions} impressions are being shown and not seen.`,
      action: `Strengthen that page for these exact words: the title first, then a paragraph that uses them, then an internal link to it from the category page.`,
    };
  }

  if (clicks === 0) {
    return {
      ...base, kind: 'title', product,
      headline: `"${query}" is on page one and nobody clicks it`,
      why: `${impressions} impressions at position ${position} with no clicks. Being seen is solved; being chosen is not, and that is the title's job.`,
      action: `Rewrite the meta title of "${best.name}" to answer this query in the shopper's own words, in the quiet-luxury voice.`,
    };
  }

  if (stock <= LOW_STOCK) {
    return {
      ...base, kind: 'depth', product,
      headline: `"${best.name}" ranks for "${query}" and is down to ${stock}`,
      why: `This is the good problem: a page that works, about to be unable to serve the demand it earned. A stock-out here also costs the ranking it took weeks to get.`,
      action: `Order more depth in "${best.name}" — and its best-selling size first.`,
    };
  }

  // Ranks on page one, earns clicks, in stock: nothing useful to say.
  return null;
}

/**
 * Most consequential first. Restock and range gaps outrank presentation work:
 * one is a sale that cannot happen, the other is a sale we never knew to offer.
 */
const KIND_ORDER = { restock: 0, range: 1, depth: 2, rank: 3, title: 4 };

function rankProposals(proposals = []) {
  // Merge proposals that are the same job. Several queries routinely land on one
  // product — "black bikini briefs" and "black satin underwear" are the same
  // restock — and listing it once per query turns one decision into a wall.
  // Impressions are SUMMED, because the demand for that product really is the
  // sum, and the headline is rewritten from the strongest query.
  const merged = new Map();
  let anonymous = 0;
  for (const p of proposals.filter(Boolean)) {
    // Identity is the product when there is one (several queries, one restock),
    // otherwise the query. With neither, merge NOTHING — collapsing rows that
    // share only a missing field would hide real work behind an unrelated item.
    const identity = p.product?.name || p.query;
    const key = identity ? `${p.kind}:${identity}` : `${p.kind}:#${anonymous++}`;
    const prev = merged.get(key);
    if (!prev) {
      merged.set(key, { ...p, queries: [p.query] });
      continue;
    }
    prev.impressions += p.impressions;
    prev.clicks += p.clicks;
    prev.queries.push(p.query);
    // Keep the best-ranking query as the representative one: it is the closest
    // to earning something, and the headline should name it.
    if (p.position && p.position < prev.position) {
      prev.query = p.query;
      prev.position = p.position;
    }
  }

  return [...merged.values()]
    .map(p => (p.queries.length > 1
      // The headline was written for ONE query and now stands over the summed
      // demand, so it must restate the total — otherwise it reads "8 people
      // searched" above an impressions figure of 14.
      ? {
        ...p,
        headline: `${p.headline} — ${p.impressions} searches in total across ${p.queries.length} terms: ${p.queries.map(t => `"${t}"`).join(', ')}`,
      }
      : p))
    .sort((a, b) =>
      (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9) ||
      b.impressions - a.impressions);
}

module.exports = { classifyDemand, rankProposals, MIN_IMPRESSIONS, PAGE_ONE, LOW_STOCK, KIND_ORDER };
