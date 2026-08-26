import { describe, it, expect } from 'vitest';

// §54: one floating utility only, and none of them may cover Add to Bag or the
// mobile sticky CTA. On a product page the bottom edge already belongs to
// StickyBuyBar, so the floating cart is a second cart control on the same
// screen — the chat bubble makes three.
//
// The rule is a path test, kept here rather than inline so the locale case is
// pinned: /de/product/... is still a product page, and a naive startsWith
// check on '/product' would show the bar on every localised PDP.
const isProductPage = (p: string) => /^\/(?:[a-z]{2}\/)?product\//.test(p || '');

describe('floating cart suppression', () => {
  it('hides on a product page', () => {
    expect(isProductPage('/product/silk-robe')).toBe(true);
  });

  it('hides on a localised product page too', () => {
    for (const l of ['de', 'fr', 'it', 'es']) {
      expect(isProductPage(`/${l}/product/silk-robe`), l).toBe(true);
    }
  });

  it('shows everywhere else, including pages whose name starts the same way', () => {
    for (const p of ['/', '/shop', '/collections/the-bridal-edit', '/journal', '/products', '/de/shop', '']) {
      expect(isProductPage(p), p).toBe(false);
    }
  });
});
