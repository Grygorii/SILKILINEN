import { describe, it, expect } from 'vitest';
import pkg from '../utils/productSearch.js';

// Pins the REAL filter from utils/productSearch.js, the one routes/products.js
// builds — this file used to mirror a copy of it, which is not testing a search
// so much as testing a second implementation of one.
//
// Two things matter here: the escaping (it stops operator injection when q
// arrives as {$ne:''}, and a ReDoS crafted against the unindexed description
// field), and the field coverage plus word handling, which is what turns "sky
// blue robe" from an empty page into a product.
const { buildSearchFilter, SEARCH_FIELDS } = pkg;

const fieldsOf = clauses => clauses.map(c => Object.keys(c)[0]);
const regexOf = clause => Object.values(clause)[0].$regex;

// Every regex the filter contains, whichever shape it took. Used for the
// security assertions, which must hold regardless of how the query was split.
const allRegexes = filter => (filter.$and ? filter.$and.flatMap(c => c.$or) : filter.$or)
  .map(clause => Object.values(clause)[0].$regex);

describe('product search filter', () => {
  it('covers the fields a shopper actually types', () => {
    expect(fieldsOf(buildSearchFilter('silk').$or)).toEqual(SEARCH_FIELDS);
  });

  it('coerces a non-string query instead of passing an operator through', () => {
    // Asserted over every regex in the filter rather than a fixed position: an
    // object coerces to "[object Object]", which contains a space and so takes
    // the multi-word path. The property that matters is shape-independent —
    // nothing reaches Mongo except escaped strings.
    const regexes = allRegexes(buildSearchFilter({ $ne: '' }));
    expect(regexes.length).toBeGreaterThan(0);
    for (const r of regexes) {
      expect(typeof r).toBe('string');
      expect(r).not.toContain('$ne');
    }
  });

  it('escapes regex metacharacters so a crafted pattern cannot run', () => {
    expect(buildSearchFilter('.*').$or.every(c => regexOf(c) === '\\.\\*')).toBe(true);
  });

  it('is case-insensitive on every field', () => {
    expect(buildSearchFilter('x').$or.every(c => Object.values(c)[0].$options === 'i')).toBe(true);
  });

  it('keeps a single word as one $or — the common case is unchanged', () => {
    const f = buildSearchFilter('robe');
    expect(f.$and).toBeUndefined();
    expect(regexOf(f.$or[0])).toBe('robe');
  });

  // The bug this rule exists to fix. The old filter regexed the WHOLE phrase
  // against each field, so a query spanning two fields matched nothing: "sky
  // blue robe" needs "robe" from the name and "Sky Blue" from colorName. The
  // empty page then reached the advisor as unmet demand, recommending we stock a
  // product we already sell.
  it('requires every word, but lets each match a different field', () => {
    const f = buildSearchFilter('sky blue robe');
    expect(f.$or).toBeUndefined();
    expect(f.$and).toHaveLength(3);
    expect(f.$and.map(clause => regexOf(clause.$or[0]))).toEqual(['sky', 'blue', 'robe']);
    // Each word still gets the full field sweep.
    for (const clause of f.$and) expect(fieldsOf(clause.$or)).toEqual(SEARCH_FIELDS);
  });

  it('ignores extra whitespace rather than searching for empty words', () => {
    const f = buildSearchFilter('  silk   robe  ');
    expect(f.$and).toHaveLength(2);
    expect(f.$and.map(c => regexOf(c.$or[0]))).toEqual(['silk', 'robe']);
  });

  it('returns null for a blank query instead of an empty $and', () => {
    // Mongo rejects { $and: [] }; a blank search should show the shop, not 500.
    for (const q of ['', '   ', null, undefined]) expect(buildSearchFilter(q)).toBeNull();
  });

  it('escapes every word of a multi-word query, not just the first', () => {
    const f = buildSearchFilter('silk .*');
    expect(f.$and.map(c => regexOf(c.$or[0]))).toEqual(['silk', '\\.\\*']);
  });
});
