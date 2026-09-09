import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const { planSlugFixes } = createRequire(import.meta.url)('../scripts/fixProductSlugs.js');

// The slug is derived from the name ONLY while it is empty, so the first name a
// product is ever given owns its URL and every rename afterwards drifts away in
// silence. On the live catalogue that produced two nightshirt URLs both saying
// "copper" for products that were Bare Champagne and Wine Red — a shopper
// clicking a copper link landed on a wine red nightshirt.
const P = (id, name, slug) => ({ _id: id, name, slug });

describe('planSlugFixes', () => {
  it('leaves a product whose slug already matches its name alone', () => {
    expect(planSlugFixes([P('1', 'Silk robe in Garnet', 'silk-robe-in-garnet')])).toEqual([]);
  });

  it('re-cuts a slug that no longer describes the product', () => {
    const [row] = planSlugFixes([P('1', 'Silk pillowcase in Pink Blush', 'silk-pillowcase-in-blue')]);
    expect(row.newSlug).toBe('silk-pillowcase-in-pink-blush');
    expect(row.review).toBeUndefined();
  });

  it('is not fooled by a slug another product is vacating in the same pass', () => {
    // The real case: both nightshirts are moving, and Wine Red's target is free
    // precisely because Bare Champagne is leaving. Judging collisions against
    // LIVE slugs would refuse both — the exact situation this exists to fix.
    const rows = planSlugFixes([
      P('1', 'Silk nightshirt in Bare Champagne', 'silk-nightshirt-in-copper'),
      P('2', 'Silk nightshirt in Wine Red', 'silk-nightshirt-in-copper-2'),
    ]);
    expect(rows.map(r => r.newSlug)).toEqual([
      'silk-nightshirt-in-bare-champagne',
      'silk-nightshirt-in-wine-red',
    ]);
    expect(rows.some(r => r.review)).toBe(false);
  });

  it('refuses to guess when two products genuinely want one slug', () => {
    // pre('save') would silently append -2 here, which is how
    // silk-nightshirt-in-copper-2 came to exist in the first place.
    const rows = planSlugFixes([
      P('1', 'Silk nightshirt in Copper', 'a'),
      P('2', 'Silk nightshirt in copper', 'b'),
    ]);
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(r.review).toMatch(/also resolves to this slug/);
  });

  it('flags a product with no usable name rather than clearing its URL', () => {
    const [row] = planSlugFixes([P('1', '', 'silk-robe-in-garnet')]);
    expect(row.review).toMatch(/no usable name/);
    expect(row.newSlug).toBeUndefined();
  });
});
