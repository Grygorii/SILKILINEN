import { describe, it, expect } from 'vitest';
import { feedTitle } from '@/lib/feedTitle';

// The Shopping title is matched against a query typed by someone who has never
// heard of the shop, so an attribute in it is a chance to be found. The
// storefront name is read by someone already on the page. Two audiences, two
// rules — which is why this is not productName.js.
describe('feed title', () => {
  it('adds the momme, which no other feed field carries', () => {
    // g:material takes the fibre, not the weight, and "19 momme silk robe" is a
    // real query.
    expect(feedTitle('Silk nightshirt in Sky Blue', '19')).toBe('Silk nightshirt in Sky Blue — 19 momme');
  });

  it('reads a weight written into the composition, like everywhere else', () => {
    expect(feedTitle('Silk robe', '', '100% Mulberry Silk 22mm Momme')).toBe('Silk robe — 22 momme');
  });

  it('claims no weight when none was recorded', () => {
    // A feed is the last place to invent a spec: it is read by a machine that
    // will repeat it in an advert.
    expect(feedTitle('Silk robe in Sage')).toBe('Silk robe in Sage');
    expect(feedTitle('Silk robe in Sage', '')).toBe('Silk robe in Sage');
    expect(feedTitle('Silk robe in Sage', null, '95% Silk 5% Elastane')).toBe('Silk robe in Sage');
  });

  it('does not prefix the brand', () => {
    // The naming convention settled this deliberately — g:brand carries it, and
    // repeating it burns characters out of the ~70 Google renders. Reversing a
    // documented decision is the founders' call, not a silent edit.
    expect(feedTitle('Silk robe', '19')).not.toMatch(/SILKILINEN/i);
  });

  it('trims the name to fit rather than losing the attribute it added', () => {
    const long = 'A'.repeat(200);
    const out = feedTitle(long, '19');
    expect(out.length).toBeLessThanOrEqual(150);
    // Cutting the suffix and keeping a half-sentence is the worst of both.
    expect(out.endsWith('— 19 momme')).toBe(true);
  });

  it('still respects the cap with no weight', () => {
    expect(feedTitle('B'.repeat(200)).length).toBe(150);
  });

  it('survives an empty name', () => {
    expect(feedTitle('', '19')).toBe('');
  });
});
