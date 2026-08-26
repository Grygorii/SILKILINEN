import { describe, it, expect } from 'vitest';
import { companionCategory, canPairWith } from '@/lib/companion';

// "Shop the look" asks a different question from "related products", and the
// difference is the whole feature: related returns another robe under a robe,
// which is an alternative to choose between, not a second piece to add.
describe('companion category', () => {
  it('pairs a garment with the accessories that complete it', () => {
    expect(companionCategory('robes')).toBe('home');
    expect(companionCategory('sleepwear')).toBe('home');
    expect(companionCategory('lounge')).toBe('home');
    expect(companionCategory('lingerie')).toBe('robes');
  });

  it('is one-directional — an accessory does not pair back up to a garment', () => {
    // Someone buying a €49 eye mask is not one click from a €168 robe, and
    // suggesting it reads as pressure rather than as a look.
    expect(companionCategory('home')).toBeNull();
  });

  it('says nothing where there is no honest pairing', () => {
    // Scarves are daywear in a sleep-and-lounge range; any partner would be
    // invented to fill the slot.
    expect(companionCategory('scarves')).toBeNull();
    expect(companionCategory('')).toBeNull();
    expect(companionCategory(null)).toBeNull();
    expect(companionCategory('not-a-category')).toBeNull();
  });

  it('is case and whitespace tolerant, since category is a stored string', () => {
    expect(companionCategory(' Robes ')).toBe('home');
  });
});

describe('pairing a specific product', () => {
  const robe = { _id: 'a', category: 'robes' };
  const mask = { _id: 'b', category: 'home', inStock: true };

  it('pairs a robe with an in-stock accessory', () => {
    expect(canPairWith(robe, mask)).toBe(true);
  });

  it('never pairs a product with itself', () => {
    // Happens whenever a garment is filed in its own companion category.
    expect(canPairWith({ _id: 'a', category: 'robes' }, { _id: 'a', category: 'home', inStock: true })).toBe(false);
  });

  it('never suggests adding something that cannot be bought', () => {
    // "Add both to bag" that silently adds one is worse than no offer.
    expect(canPairWith(robe, { ...mask, inStock: false })).toBe(false);
    expect(canPairWith(robe, { ...mask, totalStock: 0 })).toBe(false);
  });

  it('refuses a candidate from the wrong category', () => {
    expect(canPairWith(robe, { _id: 'c', category: 'scarves', inStock: true })).toBe(false);
  });

  it('refuses when either side is unidentifiable', () => {
    expect(canPairWith({ category: 'robes' }, mask)).toBe(false);
    expect(canPairWith(robe, { category: 'home', inStock: true })).toBe(false);
  });
});
