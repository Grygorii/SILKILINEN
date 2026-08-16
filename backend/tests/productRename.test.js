import { describe, it, expect } from 'vitest';
import pkg from '../utils/productName.js';

// The parser is the risky part: a wrong guess ships a bad product name to the
// storefront AND to Google. It is also now the rule the admin form enforces, so
// these tests pin the convention itself, not just the cleanup script.
const { parse, checkName } = pkg;

const name = (n, extra = {}) => parse({ name: n, ...extra }).newName;

describe('product rename parser', () => {
  it('drops the brand prefix and moves colour last', () => {
    expect(name('Silkilinen Silver silk pillowcase')).toBe('Silk pillowcase in Silver');
  });

  it('normalises an inherently plural garment', () => {
    // "Brief" and "Briefs" both existed for the same product.
    expect(name('Wine red Silk Bikini Brief')).toBe('Silk bikini briefs in Wine Red');
    expect(name('Pink Blush Silk Bikini Briefs')).toBe('Silk bikini briefs in Pink Blush');
  });

  it('keeps a named piece and does not invent a colour for it', () => {
    expect(name('The Grand Tour silk satin Scarf')).toBe('Silk satin scarf — The Grand Tour');
  });

  it('uses sentence case for a two-word material', () => {
    expect(name('The Grand Tour silk satin Scarf')).toContain('Silk satin');
    expect(name('The Grand Tour silk satin Scarf')).not.toContain('Silk Satin');
  });

  it('prefers the colour FIELD over a word it recognises in the title', () => {
    // "Pare Champagne" — only "champagne" is a known term, so stripping just
    // that left "slip dress in pare" as the garment.
    expect(name('Silk slip dress in Pare champagne', { colorName: 'Pare Champagne' }))
      .toBe('Silk slip dress in Pare Champagne');
  });

  it('is idempotent — running it on its own output changes nothing', () => {
    const once = name('Silkilinen Sage green silk pillowcase');
    expect(name(once)).toBe(once);
  });

  it('never emits a doubled material', () => {
    expect(name('Wine red Silk Bikini Brief')).not.toMatch(/silk\s+silk/i);
  });

  it('flags anything it cannot split into garment plus colour', () => {
    expect(parse({ name: 'Gift card' }).review).toBe(true);
    expect(parse({ name: '' }).review).toBe(true);
  });
});

// Artefacts found LIVE on /shop after the first run. Each one shipped to
// customers and to Google, so they are pinned here permanently.
describe('artefacts the first version produced', () => {
  it('strips the brand from the middle, not just the front', () => {
    expect(name("Silk men's pure boxer shorts — silkilinen in Copper", { colorName: 'Copper' }))
      .toBe("Silk men's pure boxer shorts in Copper");
  });

  it('strips a stray word of a two-word colour', () => {
    // "Sunset Copper" — "sunset" alone is not a known term, so it survived
    // into the garment as "Silk sunset nightshirt in Copper".
    expect(name('Silk sunset nightshirt in Copper', { colorName: 'Sunset Copper' }))
      .toBe('Silk nightshirt in Sunset Copper');
  });

  it('never emits a doubled "in"', () => {
    expect(name('Silk boxer short in bare in Champagne', { colorName: 'Bare Champagne' }))
      .not.toMatch(/\bin\b.*\bin\b/);
  });

  it('pluralises a singular pair-garment', () => {
    expect(name('Silk boxer short in Sky Blue', { colorName: 'Sky Blue' }))
      .toBe('Silk boxer shorts in Sky Blue');
  });

  it('is idempotent on every live name that had drifted', () => {
    const live = [
      ["Silk men's pure boxer shorts — silkilinen in Copper", 'Copper'],
      ['Silk slip dress in pare in Champagne', 'Pare Champagne'],
      ['Silk sunset nightshirt in Copper', 'Sunset Copper'],
      ['Silk boxer short in bare in Champagne', 'Bare Champagne'],
      ['Silk satin scarf — The Grand Tour', ''],
    ];
    for (const [n, colorName] of live) {
      const once = name(n, { colorName });
      expect(name(once, { colorName })).toBe(once);
    }
  });
});

describe('checkName (what the admin form shows)', () => {
  it('passes a name already following the convention', () => {
    const r = checkName('Silk pillowcase in Silver');
    expect(r.ok).toBe(true);
    expect(r.reasons).toEqual([]);
  });

  it('offers the corrected name and says why', () => {
    const r = checkName('Silkilinen Silver silk pillowcase');
    expect(r.ok).toBe(false);
    expect(r.suggestion).toBe('Silk pillowcase in Silver');
    expect(r.reasons.join(' ')).toMatch(/brand/i);
  });

  it('names Title Case as the problem', () => {
    expect(checkName('Pink Blush Silk Bikini Briefs').reasons.join(' ')).toMatch(/sentence case/i);
  });

  it('stays quiet about products the convention was never written for', () => {
    // A gift card is not a garment in a colour. Silence beats a complaint we
    // cannot act on.
    const r = checkName('Gift card');
    expect(r.ok).toBe(true);
    expect(r.suggestion).toBe('');
  });

  it('never suggests a name it could not parse', () => {
    expect(checkName('').suggestion).toBe('');
  });
});
