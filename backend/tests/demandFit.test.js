import { describe, it, expect } from 'vitest';
import pkg from '../utils/demandFit.js';

// The admin could display search data and never act on it: the founder was left
// to join "black bikini briefs, 8 impressions, position 8" against the catalogue
// and the stock levels in their head, weekly.
//
// The point of these tests is that identical-looking numbers demand OPPOSITE
// actions depending on what sits behind them. "8 impressions, no clicks" is a
// stocking decision, a title rewrite, or nothing at all — and getting that wrong
// sends the founder to buy inventory they already have, or to polish a title on
// a product nobody can buy.
const { classifyDemand, rankProposals, MIN_IMPRESSIONS } = pkg;

const q = (over = {}) => ({ query: 'black bikini briefs', impressions: 8, clicks: 0, position: 8, ...over });
const product = (over = {}) => ({ name: 'Silk bikini briefs in Black', totalStock: 10, status: 'active', ...over });

describe('what to do about a search query', () => {
  it('calls it a range gap when nothing in the shop matches', () => {
    const p = classifyDemand(q({ query: 'silk pyjama set', impressions: 30 }), []);
    expect(p.kind).toBe('range');
    // Must offer the free option before the expensive one: we may already sell
    // it under a word nobody searches for.
    expect(p.action).toMatch(/title or colour name/);
    expect(p.headline).toMatch(/30 searches/);
  });

  it('puts an out-of-stock product above everything else', () => {
    const p = classifyDemand(q(), [product({ totalStock: 0 })]);
    expect(p.kind).toBe('restock');
    expect(p.why).toMatch(/sale is impossible/);
  });

  it('asks for ranking work when the product is past page one', () => {
    const p = classifyDemand(q({ position: 19 }), [product()]);
    expect(p.kind).toBe('rank');
    expect(p.headline).toMatch(/page two/);
  });

  it('asks for a title rewrite when it is seen on page one and not clicked', () => {
    const p = classifyDemand(q({ position: 6, clicks: 0 }), [product()]);
    expect(p.kind).toBe('title');
    expect(p.why).toMatch(/Being seen is solved/);
  });

  it('asks for depth when a working page is nearly sold out', () => {
    const p = classifyDemand(q({ position: 4, clicks: 3 }), [product({ totalStock: 2 })]);
    expect(p.kind).toBe('depth');
    expect(p.headline).toMatch(/down to 2/);
  });

  it('says NOTHING about a query that is simply working', () => {
    // Page one, earning clicks, in stock. A list that always finds something to
    // do is a list nobody reads.
    expect(classifyDemand(q({ position: 4, clicks: 5 }), [product()])).toBeNull();
  });

  it('says nothing when the sample is too thin to carry a decision', () => {
    expect(classifyDemand(q({ impressions: MIN_IMPRESSIONS - 1 }), [])).toBeNull();
    expect(classifyDemand(q({ impressions: 1, position: 2 }), [])).toBeNull();
  });

  it('ignores a blank query rather than proposing work on nothing', () => {
    expect(classifyDemand({ query: '', impressions: 99 }, [])).toBeNull();
    expect(classifyDemand({}, [])).toBeNull();
    expect(classifyDemand(null, [])).toBeNull();
  });

  // Out-of-stock must win over every presentation problem the same query has.
  it('prefers the unbuyable product over the badly-ranked one', () => {
    const p = classifyDemand(q({ position: 19 }), [product({ totalStock: 0 })]);
    expect(p.kind).toBe('restock');
  });
});

describe('ordering the list', () => {
  it('puts sales that cannot happen above sales we present badly', () => {
    const proposals = [
      { kind: 'title', query: 'a', impressions: 100 },
      { kind: 'rank', query: 'b', impressions: 90 },
      { kind: 'range', query: 'c', impressions: 10 },
      { kind: 'restock', query: 'd', impressions: 5 },
      { kind: 'depth', query: 'e', impressions: 50 },
    ];
    expect(rankProposals(proposals).map(p => p.kind))
      .toEqual(['restock', 'range', 'depth', 'rank', 'title']);
  });

  it('breaks a tie on how much demand is at stake', () => {
    const out = rankProposals([
      { kind: 'rank', query: 'small', impressions: 12 },
      { kind: 'rank', query: 'large', impressions: 300 },
    ]);
    expect(out[0].impressions).toBe(300);
  });

  it('survives nulls in the list', () => {
    expect(rankProposals([null, { kind: 'rank', query: 'x', impressions: 1 }, undefined])).toHaveLength(1);
    expect(rankProposals([])).toEqual([]);
    // Rows with neither a product nor a query must never collapse into each
    // other — a shared missing field is not a shared job.
    expect(rankProposals([
      { kind: 'rank', impressions: 5 },
      { kind: 'rank', impressions: 7 },
    ])).toHaveLength(2);
  });
});

// Several queries routinely land on ONE product — "black bikini briefs" and
// "black satin underwear" are the same restock — and the first version of this
// list showed the same decision twice, with different numbers, one row apart.
describe('merging proposals that are the same job', () => {
  const restock = (query, impressions) => ({
    kind: 'restock', query, impressions, clicks: 0, position: 8,
    product: { name: 'Silk bikini briefs in Black', stock: 0 },
    headline: `"Silk bikini briefs in Black" is out of stock`, why: 'w', action: 'a',
  });

  it('merges by product and sums the demand', () => {
    const out = rankProposals([restock('black bikini briefs', 8), restock('black satin underwear', 6)]);
    expect(out).toHaveLength(1);
    expect(out[0].impressions).toBe(14);
    expect(out[0].queries).toEqual(['black bikini briefs', 'black satin underwear']);
  });

  it('says the number covers several searches, and names them', () => {
    const out = rankProposals([restock('black bikini briefs', 8), restock('black satin underwear', 6)]);
    // The headline was written for one query and now stands over summed demand,
    // so it must restate the total rather than leaving "8" above an impressions
    // figure of 14.
    expect(out[0].headline).toMatch(/14 searches in total/);
    expect(out[0].headline).toMatch(/black satin underwear/);
  });

  it('keeps the best-ranking query as the representative one', () => {
    const a = { ...restock('worse', 5), position: 18 };
    const b = { ...restock('better', 5), position: 4 };
    expect(rankProposals([a, b])[0].query).toBe('better');
  });

  it('does not merge different products, or different jobs on one product', () => {
    const other = { ...restock('silk chemise', 9), product: { name: 'Silk chemise in Ivory', stock: 0 } };
    expect(rankProposals([restock('black bikini briefs', 8), other])).toHaveLength(2);

    const rank = { ...restock('black bikini briefs', 8), kind: 'rank' };
    expect(rankProposals([restock('black bikini briefs', 8), rank])).toHaveLength(2);
  });

  it('merges range gaps by query, since they have no product', () => {
    const gap = (query, impressions) => ({ kind: 'range', query, impressions, clicks: 0, position: 30, product: null, headline: 'h', why: 'w', action: 'a' });
    expect(rankProposals([gap('silk pyjama set', 22), gap('silk pyjama set', 5)])[0].impressions).toBe(27);
    expect(rankProposals([gap('silk pyjama set', 22), gap('linen robe', 5)])).toHaveLength(2);
  });
});

// A waitlist entry is the strongest signal the shop can receive: a named person,
// naming the product, agreeing to buy. It lived in its own table, reachable only
// by the hourly restock sweep, so a "restock this" proposal argued from searches
// alone when it could argue from sales already agreed.
describe('restock proposals count the people waiting', () => {
  const outOfStock = (waiting) => [{ name: 'Silk bikini briefs in Black', totalStock: 0, status: 'active', waiting }];

  it('names the waitlist when there is one', () => {
    const p = classifyDemand(q({ impressions: 8 }), outOfStock(3));
    expect(p.kind).toBe('restock');
    expect(p.headline).toMatch(/3 left an email waiting/);
    expect(p.why).toMatch(/proven twice over/);
    expect(p.product.waiting).toBe(3);
  });

  it('reads naturally for a single person', () => {
    const p = classifyDemand(q(), outOfStock(1));
    expect(p.headline).toMatch(/1 left an email waiting/);
    expect(p.why).toMatch(/person who/);
    expect(p.action).toMatch(/person is/);
  });

  it('falls back to the search-only wording with an empty waitlist', () => {
    for (const waiting of [0, undefined, null]) {
      const p = classifyDemand(q(), outOfStock(waiting));
      expect(p.headline).not.toMatch(/waiting/);
      expect(p.action).toMatch(/Anyone who joins/);
      expect(p.product.waiting).toBe(0);
    }
  });
});

// Orders joined in. "Ranks well and sells" and "ranks well and has never sold"
// were the same row to the rule, and it called both fine — they are opposite
// situations: one wants more stock, the other wants a better page.
describe('sales change what a ranking product means', () => {
  const clicked = (over = {}) => q({ position: 4, clicks: 3, ...over });
  const stocked = (over = {}) => [product({ totalStock: 10, ...over })];

  it('flags a clicked, in-stock product that has never sold', () => {
    const p = classifyDemand(clicked(), stocked({ sold: 0 }), { shopSells: true });
    expect(p.kind).toBe('convert');
    expect(p.why).toMatch(/not a traffic problem/);
    expect(p.action).toMatch(/photography first/);
  });

  it('stays silent when the same product does sell', () => {
    expect(classifyDemand(clicked(), stocked({ sold: 4 }), { shopSells: true })).toBeNull();
  });

  // The guard that matters most. In a shop with no orders at all, EVERY product
  // has sold nothing; diagnosing each product page would bury the real problem —
  // nobody is arriving — under a dozen confident false findings.
  it('never blames the page when the shop has sold nothing at all', () => {
    expect(classifyDemand(clicked(), stocked({ sold: 0 }), { shopSells: false })).toBeNull();
    // And defaults to that safer reading when nobody says.
    expect(classifyDemand(clicked(), stocked({ sold: 0 }))).toBeNull();
  });

  it('does not call it a conversion problem when nobody has clicked', () => {
    // No clicks is a title problem, not a page problem — the shopper never
    // arrived to be disappointed.
    const p = classifyDemand(q({ position: 4, clicks: 0 }), stocked({ sold: 0 }), { shopSells: true });
    expect(p.kind).toBe('title');
  });

  it('prefers the conversion problem over buying more of something that never sells', () => {
    // Low stock AND no sales: ordering depth here would spend money restocking a
    // product the page cannot sell.
    const p = classifyDemand(clicked(), [product({ totalStock: 2, sold: 0 })], { shopSells: true });
    expect(p.kind).toBe('convert');
  });

  it('still asks for depth when the nearly-empty product is selling', () => {
    const p = classifyDemand(clicked(), [product({ totalStock: 2, sold: 6 })], { shopSells: true });
    expect(p.kind).toBe('depth');
    expect(p.why).toMatch(/6 sold/);
  });

  it('ranks a reorder above a diagnosis', () => {
    const out = rankProposals([
      { kind: 'convert', query: 'a', impressions: 50 },
      { kind: 'depth', query: 'b', impressions: 10 },
    ]);
    expect(out.map(p => p.kind)).toEqual(['depth', 'convert']);
  });
});

// On-site searches are folded into the same list as Google's, because two lists
// saying similar things in different places is how they end up disagreeing. They
// are NOT the same evidence, though: someone typing into the shop's own search
// box has already arrived and named what they came for.
describe('demand observed on the shop itself', () => {
  const site = (over = {}) => ({ query: 'silk pyjama set', impressions: 3, clicks: 0, position: 0, source: 'site', ...over });

  it('is held to a lower bar than a Google impression', () => {
    // Two people asking on-site beats five impressions on a page nobody read.
    expect(classifyDemand(site({ impressions: 2 }), [])).not.toBeNull();
    // The Google floor still applies to Google.
    expect(classifyDemand({ ...site({ impressions: 2 }), source: 'google' }, [])).toBeNull();
  });

  it('still refuses a single search', () => {
    expect(classifyDemand(site({ impressions: 1 }), [])).toBeNull();
  });

  it('says where the demand was seen, not just how much', () => {
    const p = classifyDemand(site(), []);
    expect(p.kind).toBe('range');
    expect(p.source).toBe('site');
    expect(p.headline).toMatch(/ON the shop/);
    expect(p.why).toMatch(/already here/);
  });

  it('reads naturally for one person', () => {
    expect(classifyDemand(site({ impressions: 2 }), []).headline).toMatch(/2 people searched/);
    const one = classifyDemand({ ...site(), impressions: 1, source: 'site' }, []);
    expect(one).toBeNull(); // below the floor, but the singular path is exercised below
    expect(classifyDemand(site({ impressions: 2 }), []).headline).not.toMatch(/1 person/);
  });

  // The trap: an on-site search knows nothing about Google positions, so running
  // the ranking branches would produce "on page one and nobody clicks it" about
  // a search that never touched Google.
  it('never invents a ranking verdict from an on-site search', () => {
    const p = classifyDemand(site(), [product({ totalStock: 10 })]);
    expect(p).toBeNull();
  });

  it('does report a matched product that cannot be bought', () => {
    // The one reading that survives: they searched, we have it, they cannot buy it.
    const p = classifyDemand(site(), [product({ totalStock: 0, waiting: 2 })]);
    expect(p.kind).toBe('restock');
    expect(p.product.waiting).toBe(2);
  });
});
