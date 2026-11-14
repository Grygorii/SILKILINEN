import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_LOCALES, localeFromPathname, localeHref } from '@/lib/i18n';
import { getDictionary } from '@/lib/dictionaries';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('storefront translations', () => {
  it('provides the complete shopping dictionary for every locale', () => {
    const shape = (value: unknown): unknown => value && typeof value === 'object'
      ? Object.fromEntries(Object.entries(value).map(([key, child]) => [key, shape(child)]))
      : typeof value;
    const englishShape = shape(getDictionary('en'));
    for (const locale of ALL_LOCALES) {
      expect(shape(getDictionary(locale))).toEqual(englishShape);
      expect(JSON.stringify(getDictionary(locale))).not.toContain('""');
    }
  });

  it('keeps localized shop, product and checkout links in the selected language', () => {
    for (const locale of ALL_LOCALES) {
      expect(localeFromPathname(localeHref(locale, '/checkout'))).toBe(locale);
      expect(localeHref(locale, '/product/test')).toBe(locale === 'en' ? '/product/test' : `/${locale}/product/test`);
    }
  });

  it('uses the selected language in the mobile purchase path', () => {
    const sticky = read('components/StickyBuyBar.tsx');
    const quickAdd = read('components/QuickAddSheet.tsx');
    const cart = read('components/CartPanel.tsx');

    expect(sticky).toContain('const copy = getDictionary(locale);');
    expect(sticky).toContain('label = copy.product.add;');
    expect(quickAdd).toContain('const copy = getDictionary(locale);');
    expect(quickAdd).toContain('copy.product.quantity');
    expect(cart).toContain('copy.cart.calculatedAtCheckout');
    expect(cart).toContain('copy.cart.moreForFreeShipping');
  });
});
