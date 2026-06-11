import { describe, it, expect } from 'vitest';
import { calculateShipping, getTierForCountry } from '../services/shipping.js';

// Free shipping is €150 for ALL regions (business rule). These tests lock that
// in so a future tier edit can't silently reintroduce a higher threshold.
describe('calculateShipping — free shipping over €150 everywhere', () => {
  const regions = [
    ['IE', 4.99],   // Ireland
    ['GB', 14.99],  // United Kingdom
    ['DE', 9.99],   // Europe
    ['US', 14.99],  // US/Canada/Australia
    ['JP', 19.99],  // Worldwide (unlisted country)
  ];

  for (const [country, cost] of regions) {
    it(`${country}: free at exactly €150`, () => {
      expect(calculateShipping(country, 150).isFree).toBe(true);
      expect(calculateShipping(country, 150).cost).toBe(0);
    });
    it(`${country}: charges €${cost} below €150`, () => {
      const r = calculateShipping(country, 149.99);
      expect(r.isFree).toBe(false);
      expect(r.cost).toBe(cost);
    });
    it(`${country}: free threshold is 150`, () => {
      expect(calculateShipping(country, 0).freeThreshold).toBe(150);
    });
  }

  it('unknown/empty country falls back to the worldwide tier', () => {
    expect(getTierForCountry('ZZ').label).toBe('Worldwide');
    expect(calculateShipping('ZZ', 200).isFree).toBe(true);
  });

  it('Northern Ireland (GB code via IM/JE/GG) maps to the UK tier', () => {
    expect(getTierForCountry('IM').label).toBe('United Kingdom');
  });
});
