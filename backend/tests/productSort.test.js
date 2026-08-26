import { describe, it, expect } from 'vitest';
import pkg from '../utils/productSort.js';

const { SORTS, DEFAULT_SORT, sortSpec, sortKey } = pkg;

// routes/products.js had one line — `if (sort === '-createdAt')` — so every
// other value fell through to Mongo's natural order. That is the dangerous
// shape: "sort by price low to high" would have returned insertion order and
// looked like it worked, because a shop of thirty pieces in arbitrary order is
// indistinguishable from a shop sorted by something you cannot see.
describe('productSort', () => {
  it('orders by price in both directions', () => {
    expect(sortSpec('price-asc')).toEqual({ price: 1 });
    expect(sortSpec('price-desc')).toEqual({ price: -1 });
  });

  it('orders by newest', () => {
    expect(sortSpec('newest')).toEqual({ createdAt: -1 });
  });

  it('keeps the legacy value the storefront already links with', () => {
    // NewArrivals has requested sort=-createdAt since before this whitelist.
    // Dropping it would silently un-sort the homepage band.
    expect(sortSpec('-createdAt')).toEqual({ createdAt: -1 });
  });

  it('leaves the shop in its own order by default', () => {
    // null, not {} — an empty sort spec is still a call into Mongo's sort.
    expect(sortSpec('featured')).toBe(null);
    expect(sortSpec(undefined)).toBe(null);
    expect(sortSpec('')).toBe(null);
  });

  it('never passes an unknown key through to the sort spec', () => {
    // `sort` reaches Mongo's sort specification, so an arbitrary field name
    // from the query string is an ordering oracle over fields the projection
    // does not return.
    for (const bad of ['price', 'stockLevel', '{"price":1}', 'costPrice', '__proto__', 'constructor']) {
      expect(sortSpec(bad), bad).toBe(null);
    }
  });

  it('falls back rather than erroring on nonsense', () => {
    // Someone editing the URL should get the shop, not a 400.
    for (const bad of [null, undefined, 42, {}, [], 'nope']) {
      expect(sortKey(bad)).toBe(DEFAULT_SORT);
    }
  });

  it('reports the active key so a UI can mark it', () => {
    expect(sortKey('price-asc')).toBe('price-asc');
    expect(sortKey('  newest  ')).toBe('newest');
  });

  it('has a spec for every value it advertises', () => {
    for (const key of Object.keys(SORTS)) {
      expect(sortKey(key), key).toBe(key);
    }
  });
});

// ── The storefront's options must exist in this whitelist ──────────────────
//
// Two files, one fact. components/SortLinks.tsx decides what the orders are
// CALLED on screen; utils/productSort.js decides which ones exist. A key in the
// first that is missing from the second produces the worst possible failure:
// the link works, the page reloads, the grid comes back in the shop's own order
// and nothing anywhere says the sort was ignored.
//
// The frontend cannot require the backend, so this asserts they agree — the
// same shape as tests/siteCopySync.test.js.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SORT_LINKS = path.join(HERE, '..', '..', 'frontend', 'components', 'SortLinks.tsx');

describe('storefront sort options', () => {
  const src = fs.readFileSync(SORT_LINKS, 'utf8');
  const keys = [...src.matchAll(/\{\s*key:\s*'([^']+)'/g)].map(m => m[1]);

  it('finds the options to check', () => {
    // Guards against the regex silently matching nothing, which would make
    // every assertion below pass vacuously.
    expect(keys.length).toBeGreaterThanOrEqual(3);
  });

  it('offers only orders the API actually implements', () => {
    for (const key of keys) {
      expect(Object.prototype.hasOwnProperty.call(SORTS, key), `${key} is offered on the shop but absent from SORTS`).toBe(true);
    }
  });

  it('offers the default order as one of its choices', () => {
    // Otherwise a shopper who sorts by price has no way back to the shop's own
    // order except editing the URL.
    expect(keys).toContain(DEFAULT_SORT);
  });
});
