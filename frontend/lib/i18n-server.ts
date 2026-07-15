import { headers } from 'next/headers';
import { isLocale, type PageLocale } from './i18n';

// Server-only i18n: reads the active locale from the middleware-set `x-locale`
// header ('en' when absent). Kept in a separate module so next/headers never
// leaks into a client bundle (which fails the Next.js build). Re-exports the
// client-safe helpers so server pages can import everything from one place.
export * from './i18n';

export async function getLocale(): Promise<PageLocale> {
  try {
    const h = await headers();
    const l = h.get('x-locale');
    return isLocale(l) ? l : 'en';
  } catch {
    return 'en';
  }
}
