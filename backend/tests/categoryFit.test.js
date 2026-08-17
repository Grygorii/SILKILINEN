import { describe, it, expect } from 'vitest';
import pkg from '../utils/categoryFit.js';

// Pins the REAL rule from utils/categoryFit.js, the one services/advisor.js
// calls — not a copy of it. This file used to define its own private version of
// `misfiled`, so it passed while no such rule existed in production at all.
//
// The category is repeated in three customer-facing places — the breadcrumb, the
// shop filter and g:product_type in the Shopping feed — so one wrong value is
// wrong three times, confidently. The rule must be conservative: a false flag
// sends the founder to "fix" something already correct.
const { misfiledCategory } = pkg;

const misfiled = (name, category, known) => Boolean(misfiledCategory(name, category, known));

describe('misfiled category detection', () => {
  it('flags the real case: a nightshirt in Loungewear', () => {
    expect(misfiled('Silk nightshirt in Sunset Copper', 'lounge')).toBe(true);
  });

  it('leaves correctly filed products alone', () => {
    expect(misfiled('Silk kimono robe in Garnet', 'robes')).toBe(false);
    expect(misfiled('Silk bikini briefs in Black', 'lingerie')).toBe(false);
    expect(misfiled('Silk pillowcase in Silver', 'home')).toBe(false);
    expect(misfiled('Silk satin scarf — The Grand Tour', 'scarves')).toBe(false);
  });

  it('accepts a garment that legitimately belongs to two categories', () => {
    // A slip dress is defensible as either.
    expect(misfiled('Silk slip dress in Garnet', 'sleepwear')).toBe(false);
    expect(misfiled('Silk slip dress in Garnet', 'lingerie')).toBe(false);
  });

  it('says nothing about garments it has no rule for', () => {
    expect(misfiled('Silk boxer shorts in Sky Blue', 'lounge')).toBe(false);
    expect(misfiled('Gift card', 'lingerie')).toBe(false);
  });

  it('never flags a product with no category rather than guessing', () => {
    expect(misfiled('Silk nightshirt in Copper', '')).toBe(false);
    expect(misfiled('Silk nightshirt in Copper', undefined)).toBe(false);
  });

  it('names where the product should go, so the advice is actionable', () => {
    expect(misfiledCategory('Silk nightshirt in Sunset Copper', 'lounge'))
      .toEqual({ garment: 'nightshirt', expected: ['sleepwear'] });
  });

  it('stays quiet when the category it would suggest does not exist', () => {
    // The nine original categories were merged into six once already. Advising a
    // move to "sleepwear" in a shop that has no sleepwear is unfollowable.
    const known = ['robes', 'lingerie', 'lounge', 'home', 'scarves'];
    expect(misfiled('Silk nightshirt in Sunset Copper', 'lounge', known)).toBe(false);
    // …but still flags it once the target is live.
    expect(misfiled('Silk nightshirt in Sunset Copper', 'lounge', [...known, 'sleepwear'])).toBe(true);
  });

  it('offers only the target categories that actually exist', () => {
    const known = ['robes', 'lingerie', 'lounge', 'home', 'scarves'];
    // A slip dress can be sleepwear or lingerie; only lingerie is live here.
    expect(misfiledCategory('Silk slip dress in Garnet', 'lounge', known))
      .toEqual({ garment: 'slip dress', expected: ['lingerie'] });
  });
});
