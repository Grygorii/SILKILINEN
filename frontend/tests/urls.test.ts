import { describe, it, expect } from 'vitest';
import { productPath, productHref, collectionPath, categoryPath, categoryHref } from '@/lib/urls';

// lib/urls.ts is the single source of truth for storefront URLs, and an ESLint
// rule fails the build on a hand-built /product/ link — but nothing checked that
// the owner itself produces the right URL. The bug it was written for was
// Google indexing /product/<ObjectId> alongside /product/<slug>: two URLs for one
// page, splitting the ranking signal. That is a silent, expensive failure, so
// "prefers the slug" is the assertion that matters most here.
describe('product URLs', () => {
  it('always prefers the slug over the ObjectId', () => {
    expect(productPath({ slug: 'silk-robe', _id: '65f0a1b2c3d4e5f6a7b8c9d0' })).toBe('/product/silk-robe');
  });

  it('falls back to the id only when there is no slug', () => {
    expect(productPath({ _id: '65f0a1b2c3d4e5f6a7b8c9d0' })).toBe('/product/65f0a1b2c3d4e5f6a7b8c9d0');
  });

  it('treats a blank or whitespace slug as absent, not as a URL', () => {
    // '' and '   ' both used to produce /product/ — a page that does not exist.
    expect(productPath({ slug: '', _id: 'abc' })).toBe('/product/abc');
    expect(productPath({ slug: '   ', _id: 'abc' })).toBe('/product/abc');
  });

  it('sends a product with no identifier to the shop rather than nowhere', () => {
    expect(productPath({})).toBe('/shop');
    expect(productPath(null)).toBe('/shop');
    expect(productPath(undefined)).toBe('/shop');
  });
});

// A literal https://www.silkilinen.com/... in a canonical silently breaks the
// /de|/fr|/it|/es versions — it has happened once already. These pin that the
// locale-aware helpers prefix every market and leave English alone.
describe('locale-aware hrefs', () => {
  it('leaves English unprefixed', () => {
    expect(productHref({ slug: 'silk-robe' }, 'en')).toBe('/product/silk-robe');
    expect(productHref({ slug: 'silk-robe' })).toBe('/product/silk-robe');
  });

  it('prefixes every other market', () => {
    for (const l of ['de', 'fr', 'it', 'es'] as const) {
      expect(productHref({ slug: 'silk-robe' }, l)).toBe(`/${l}/product/silk-robe`);
    }
  });

  it('prefixes a category listing without mangling its query string', () => {
    expect(categoryHref('robes', 'de')).toBe('/de/shop?category=robes');
  });
});

describe('collection and category paths', () => {
  it('builds a collection path from the slug', () => {
    expect(collectionPath({ slug: 'bridal-edit' })).toBe('/collections/bridal-edit');
  });

  it('falls back to the shop when a collection has no slug', () => {
    expect(collectionPath({})).toBe('/shop');
    expect(collectionPath({ slug: '  ' })).toBe('/shop');
  });

  it('encodes a category slug, so a stray space cannot break the URL', () => {
    // The shop has shipped a collection slug containing spaces and commas
    // before; encoding here is what keeps that from producing a broken link.
    expect(categoryPath('home & sleep')).toBe('/shop?category=home%20%26%20sleep');
  });

  it('sends an empty category to the unfiltered shop', () => {
    expect(categoryPath('')).toBe('/shop');
    expect(categoryPath(null)).toBe('/shop');
  });
});
