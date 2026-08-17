import { describe, it, expect } from 'vitest';
import { isExcludedFromAnalytics as excluded } from '@/lib/analyticsExclude';

// Both trackers read this rule (lib/track.ts and components/VercelAnalytics.tsx),
// so a hole here pollutes the clickstream that feeds the funnel, the advisor and
// every agent — with the founder's own browsing, on a shop that has little
// traffic to dilute it. There was no frontend test runner when the rule was
// written; these were verified by a throwaway script, which is not a guard.
describe('what analytics must not count', () => {
  it('drops the admin, exactly and beneath', () => {
    expect(excluded('/admin')).toBe(true);
    expect(excluded('/admin/products')).toBe(true);
  });

  it('drops the preview surfaces', () => {
    expect(excluded('/journal/preview')).toBe(true);
    expect(excluded('/journal/preview/abc')).toBe(true);
    expect(excluded('/product/preview/x')).toBe(true);
  });

  // The case neither tracker had, and the easiest to miss: InlineEdit turns the
  // REAL storefront into a work surface, so the path looks like ordinary
  // shopping and only the query string says otherwise.
  it('drops the inline editor, which looks exactly like shopping', () => {
    expect(excluded('/product/silk-robe', '?edit=1')).toBe(true);
    expect(excluded('/', '?edit=1')).toBe(true);
  });

  it('is not fooled by a locale prefix', () => {
    // /de/journal/preview was excluded by neither tracker, because the rules
    // matched from the start of the path and i18n put a market in front.
    expect(excluded('/de/journal/preview/abc')).toBe(true);
    expect(excluded('/de/admin')).toBe(true);
    expect(excluded('/fr/admin/orders')).toBe(true);
  });

  it('still counts real shopping', () => {
    expect(excluded('/')).toBe(false);
    expect(excluded('/product/silk-robe')).toBe(false);
    expect(excluded('/de/product/silk-robe')).toBe(false);
    expect(excluded('/shop', '?category=robes')).toBe(false);
    expect(excluded('/de')).toBe(false);
  });

  it('does not swallow a storefront slug that merely starts the same way', () => {
    // A bare startsWith('/admin') would drop both of these.
    expect(excluded('/administrators-guide')).toBe(false);
    expect(excluded('/journal/previews-of-silk')).toBe(false);
  });

  it('treats only edit=1 as editing', () => {
    expect(excluded('/product/x', '?edit=0')).toBe(false);
    expect(excluded('/product/x', '')).toBe(false);
  });

  it('survives a missing query string, since one caller has only a pathname', () => {
    expect(() => excluded('/product/x')).not.toThrow();
  });
});
