// i18n core — CLIENT-SAFE. English is the default and stays UNPREFIXED (/shop);
// the four extra locales are path-prefixed (/de/shop, /fr/…) and served via
// middleware. This module must NOT import next/headers (it's imported by client
// components like LanguageSwitcher); the server-only getLocale() lives in
// lib/i18n-server.ts.

export const LOCALES = ['de', 'fr', 'it', 'es'] as const;
export type Locale = (typeof LOCALES)[number];
export type PageLocale = Locale | 'en';
export const DEFAULT_LOCALE: PageLocale = 'en';
export const ALL_LOCALES: PageLocale[] = ['en', ...LOCALES];

export const LOCALE_LABELS: Record<PageLocale, string> = {
  en: 'English', de: 'Deutsch', fr: 'Français', it: 'Italiano', es: 'Español',
};

export function isLocale(x: string | null | undefined): x is Locale {
  return !!x && (LOCALES as readonly string[]).includes(x);
}

// A locale-prefixed href: '/de/shop'. English is unprefixed: '/shop'.
export function localeHref(locale: PageLocale, path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (locale === 'en') return p;
  return `/${locale}${p === '/' ? '' : p}`;
}

// The `?locale=` query the backend read-merge expects (empty for English).
export function apiLocaleQuery(locale: PageLocale): string {
  return locale === 'en' ? '' : `locale=${locale}`;
}

// Base URL per locale for canonical + hreflang tags.
export const SITE = 'https://www.silkilinen.com';
export function localeUrl(locale: PageLocale, path: string): string {
  return `${SITE}${localeHref(locale, path)}`;
}

// hreflang alternates map for a given (unprefixed) path — for Metadata.alternates.
export function hreflangAlternates(path: string): Record<string, string> {
  const out: Record<string, string> = { 'en': localeUrl('en', path), 'x-default': localeUrl('en', path) };
  for (const l of LOCALES) out[l] = localeUrl(l, path);
  return out;
}
