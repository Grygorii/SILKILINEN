import { describe, it, expect } from 'vitest';
import { pageNameFromPath } from '@/lib/pageName';

// Visits were tracked by hand-mounting <PageTracker> on individual pages, and it
// had been mounted on exactly two: the homepage and the product page. /shop —
// which took 14 requests in a week and is the shop's best-performing search
// landing page — recorded nothing, along with /collections, /journal, /about and
// /checkout. The funnel's first stage is "Visited the site", so every rate below
// it was computed against a fraction of real traffic, in the flattering
// direction. Vercel counting visitors our own tracker never saw is what exposed
// it.
describe('naming a visit', () => {
  it('names the storefront routes that were never tracked at all', () => {
    expect(pageNameFromPath('/shop')).toBe('shop');
    expect(pageNameFromPath('/about')).toBe('about');
    expect(pageNameFromPath('/checkout')).toBe('checkout');
    expect(pageNameFromPath('/reviews')).toBe('reviews');
    expect(pageNameFromPath('/style-finder')).toBe('style-finder');
  });

  it('keeps the homepage as "home"', () => {
    expect(pageNameFromPath('/')).toBe('home');
    expect(pageNameFromPath('')).toBe('home');
  });

  // The guard against counting one visit twice: the product page keeps its own
  // tracker because that one carries the productId.
  it('leaves product pages to their own tracker', () => {
    expect(pageNameFromPath('/product/silk-robe-in-garnet')).toBeNull();
    expect(pageNameFromPath('/product')).toBeNull();
    expect(pageNameFromPath('/de/product/silk-robe-in-garnet')).toBeNull();
  });

  it('records a kind, not a slug, for collections and articles', () => {
    // One label per article would fragment the funnel into noise while telling
    // us nothing the page-level events do not.
    expect(pageNameFromPath('/collections/bridal-edit')).toBe('collection');
    expect(pageNameFromPath('/journal/how-to-wash-silk')).toBe('journal');
    expect(pageNameFromPath('/bundles/the-sleep-set')).toBe('bundle');
    // The index pages stay distinct from the individual ones.
    expect(pageNameFromPath('/journal')).toBe('journal');
    expect(pageNameFromPath('/collections')).toBe('collections');
  });

  it('treats a market prefix as the same page, not a different one', () => {
    // /de/shop and /shop are one page in the funnel; counting them apart would
    // split every rate across five markets.
    for (const l of ['de', 'fr', 'it', 'es']) {
      expect(pageNameFromPath(`/${l}/shop`)).toBe('shop');
      expect(pageNameFromPath(`/${l}`)).toBe('home');
    }
  });

  it('does not mistake a two-letter route for a market', () => {
    // Only real locales are stripped; an unrelated short segment is a page.
    expect(pageNameFromPath('/qa')).toBe('qa');
  });

  it('never returns an empty label for an odd path', () => {
    for (const p of ['//', '/shop/', '/shop//x']) {
      const name = pageNameFromPath(p);
      expect(name === null || name.length > 0).toBe(true);
    }
  });
});
