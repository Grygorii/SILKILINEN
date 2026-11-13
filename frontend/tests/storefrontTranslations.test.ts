import { describe, expect, it } from 'vitest';
import { ALL_LOCALES, localeFromPathname, localeHref } from '@/lib/i18n';
import { getDictionary } from '@/lib/dictionaries';

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
});
