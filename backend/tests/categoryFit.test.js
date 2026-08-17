import { describe, it, expect } from 'vitest';

// Mirrors the misfiled-category rule in services/advisor.js. The category is
// repeated in three customer-facing places — the breadcrumb, the shop filter
// and g:product_type in the Shopping feed — so one wrong value is wrong three
// times, confidently. The rule must be conservative: a false flag sends the
// founder to "fix" something already correct.
const GARMENT_CATEGORY = {
  nightshirt: ['sleepwear'], pyjama: ['sleepwear'], 'slip dress': ['sleepwear', 'lingerie'],
  robe: ['robes'], kimono: ['robes'],
  brief: ['lingerie'], knicker: ['lingerie'], bikini: ['lingerie'],
  pillowcase: ['home'], eyemask: ['home'], 'eye mask': ['home'],
  scarf: ['scarves'],
};
function misfiled(name, category) {
  const n = String(name).toLowerCase();
  const c = String(category).toLowerCase();
  if (!c) return false;
  const hit = Object.entries(GARMENT_CATEGORY).find(([w]) => n.includes(w));
  return Boolean(hit && !hit[1].includes(c));
}

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
  });
});
