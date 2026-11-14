import { describe, expect, it } from 'vitest';
import pkg from '../services/competitorScraper.js';

const { currencyFromCart } = pkg;

describe('competitor scraper currency evidence', () => {
  it('keeps a confirmed Shopify cart currency', () => {
    expect(currencyFromCart({ currency: 'gbp' })).toBe('GBP');
  });

  it('leaves absent or invalid storefront currency unknown instead of guessing', () => {
    expect(currencyFromCart({})).toBe(null);
    expect(currencyFromCart({ currency: '€' })).toBe(null);
  });
});
