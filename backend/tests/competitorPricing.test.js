import { describe, expect, it } from 'vitest';
import pkg from '../services/competitorPricing.js';

const { buildCompetitorPricingAdvice, toEur } = pkg;
const NOW = new Date('2026-11-14T12:00:00.000Z');

function product(overrides = {}) {
  return {
    _id: 'mask',
    name: 'Silk eyemask in Copper',
    price: 49,
    status: 'active',
    category: 'home',
    materialComposition: '100% Mulberry silk',
    momme: '19',
    costing: { totalUnitCost: 14 },
    colorVariants: [],
    ...overrides,
  };
}

function profile(name, price, currency = 'EUR', overrides = {}) {
  return {
    name,
    domain: `${name.toLowerCase().replace(/\s+/g, '-')}.example`,
    platform: 'shopify',
    currency,
    lastScrapedAt: NOW.toISOString(),
    sampleProducts: [{ title: 'Mulberry silk eye mask', price, url: `https://${name}.example/products/mask` }],
    ...overrides,
  };
}

function advice(products, profiles, options = {}) {
  return buildCompetitorPricingAdvice({
    products,
    profiles,
    rates: { EUR: 1, GBP: 0.84, USD: 1.08 },
    now: NOW,
    ...options,
  });
}

describe('competitor pricing advice', () => {
  it('never uses unknown-currency prices for a numeric peer band', () => {
    const result = advice([product()], [
      profile('One', 60, null), profile('Two', 65, null), profile('Three', 70, null),
    ]);
    const [item] = result.products;

    expect(item.market.band).toBe(null);
    expect(item.confidence.key).toBe('insufficient');
    expect(item.recommendation.key).toBe('collect_more_evidence');
    expect(item.market.ignoredUnknownCurrency).toBe(3);
  });

  it('converts known GBP prices to EUR in the correct direction', () => {
    expect(toEur(84, 'GBP', { EUR: 1, GBP: 0.84 })).toBe(100);
    const result = advice([product()], [
      profile('One', 84, 'GBP'), profile('Two', 100), profile('Three', 110),
    ]);
    const [item] = result.products;

    expect(item.market.band).not.toBe(null);
    expect(item.market.evidence[0].priceEur).toBe(100);
    expect(item.market.band?.median).toBe(100);
  });

  it('matches product families instead of using a whole-shop price average', () => {
    const result = advice([product()], [
      profile('Mask one', 60),
      profile('Mask two', 65),
      profile('Robe only', 350, 'EUR', { sampleProducts: [{ title: 'Long silk robe', price: 350 }] }),
    ]);
    const [item] = result.products;

    expect(item.market.evidence.map(evidence => evidence.competitor)).toEqual(['Mask one', 'Mask two']);
    expect(item.market.band).toBe(null);
  });

  it('asks for finance costing before it gives a price move', () => {
    const result = advice([product({ costing: {} })], [
      profile('One', 60), profile('Two', 65), profile('Three', 70),
    ]);

    expect(result.products[0].recommendation.key).toBe('complete_costing_first');
  });

  it('protects a lower ticket rather than recommending a discount', () => {
    const result = advice([product({ price: 30 })], [
      profile('One', 60), profile('Two', 65), profile('Three', 70),
    ]);
    const recommendation = result.products[0].recommendation;

    expect(recommendation.key).toBe('protect_position');
    expect(recommendation.title.toLowerCase()).toContain('do not discount');
  });

  it('surfaces a linked-colour price difference for manual architecture review', () => {
    const copper = product({ _id: 'copper', colorVariants: [{ productId: 'cream' }] });
    const cream = product({ _id: 'cream', name: 'Silk eyemask in Cream', price: 48, colorVariants: [{ productId: 'copper' }] });
    const result = advice([copper, cream], [
      profile('One', 60), profile('Two', 65), profile('Three', 70),
    ]);

    expect(result.products.every(item => item.recommendation.key === 'review_price_architecture')).toBe(true);
    expect(result.summary.reviewPriceArchitecture).toBe(2);
  });

  it('rejects stale price evidence instead of treating it as current market data', () => {
    const stale = new Date(NOW.getTime() - 22 * 24 * 60 * 60 * 1000).toISOString();
    const result = advice([product()], [
      profile('One', 60, 'EUR', { lastScrapedAt: stale }),
      profile('Two', 65, 'EUR', { lastScrapedAt: stale }),
      profile('Three', 70, 'EUR', { lastScrapedAt: stale }),
    ]);

    expect(result.products[0].confidence.key).toBe('insufficient');
    expect(result.products[0].market.ignoredStale).toBe(3);
  });
});
