import { describe, it, expect } from 'vitest';
import config from '../config/categories.js';
import fitPkg from '../utils/categoryFit.js';

// This file had drifted out of agreement with the database: it listed the nine
// pre-merge slugs long after consolidateCategories.js reduced them to six, which
// made migrateCategories.js report live categories as non-canonical and
// merged-away ones as canonical. These tests pin the properties that made that
// drift damaging, so the next edit here fails loudly instead of silently.
const { CATEGORIES, SLUGS, DEFAULT_CATEGORY } = config;
const { GARMENT_CATEGORY } = fitPkg;

describe('category config', () => {
  it('has one entry per slug, with no duplicates', () => {
    expect(SLUGS).toHaveLength(CATEGORIES.length);
    expect(new Set(SLUGS).size).toBe(SLUGS.length);
  });

  it('holds slugs that are already normalised — this list IS the URL', () => {
    // Category has no previousSlugs, so its slug is the string stored on
    // Product.category. A space or capital here would orphan products.
    for (const slug of SLUGS) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('names the default explicitly, and it must be a real category', () => {
    // The default used to be SLUGS[0]: reordering the list silently changed the
    // category every new product landed in. Naming it removes the coupling to
    // order; this assertion removes the risk of naming one that does not exist.
    expect(typeof DEFAULT_CATEGORY).toBe('string');
    expect(SLUGS).toContain(DEFAULT_CATEGORY);
  });

  it('can express every category the garment rule wants to move products into', () => {
    // The two lists are maintained separately and must not disagree: a rule that
    // says "this belongs in sleepwear" is useless if sleepwear is not a category
    // the shop has. This is the check that catches a merge happening on one side
    // only — which is exactly what went wrong here before.
    const wanted = new Set(Object.values(GARMENT_CATEGORY).flat());
    const missing = [...wanted].filter(c => !SLUGS.includes(c));
    expect(missing).toEqual([]);
  });
});
