import { describe, it, expect } from 'vitest';
import { cardColour } from '@/lib/productColour';

describe('cardColour', () => {
  it('says nothing when the name already carries the colour', () => {
    // The canonical name format from backend/utils/productName.js. This is the
    // assertion the whole module exists for.
    expect(cardColour({ name: 'Silk Kimono Robe in Sky Blue', colorName: 'Sky Blue' })).toBe(null);
  });

  it('prints the colour when the name does not', () => {
    expect(cardColour({ name: 'Silk Kimono Robe', colorName: 'Sky Blue' })).toBe('Sky Blue');
  });

  it('matches regardless of case and hyphenation', () => {
    expect(cardColour({ name: 'Silk Robe in sky-blue', colorName: 'Sky Blue' })).toBe(null);
  });

  it('falls back to the single colour option when there is no colorName', () => {
    expect(cardColour({ name: 'Silk Robe', colours: ['Emerald Green'] })).toBe('Emerald Green');
  });

  it('stays silent when the record holds several colours', () => {
    // One line would name the first and misdescribe the others. The product
    // page has swatches for this.
    expect(cardColour({ name: 'Silk Robe', colours: ['Ivory', 'Emerald Green'] })).toBe(null);
  });

  it('prefers an explicit colorName even when options are listed', () => {
    expect(cardColour({ name: 'Silk Robe', colorName: 'Ivory', colours: ['Ivory', 'Sky Blue'] })).toBe('Ivory');
  });

  it('treats placeholders as no colour at all', () => {
    for (const p of ['One Colour', 'one color', 'Default', 'N/A', 'Assorted']) {
      expect(cardColour({ name: 'Silk Eye Mask', colorName: p }), p).toBe(null);
    }
  });

  it('handles a missing or blank record without throwing', () => {
    expect(cardColour({})).toBe(null);
    expect(cardColour({ name: 'Silk Robe', colorName: '   ' })).toBe(null);
    expect(cardColour({ name: null, colorName: 'Ivory' })).toBe('Ivory');
  });
});
