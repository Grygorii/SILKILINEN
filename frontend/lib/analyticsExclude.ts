import { LOCALES } from './i18n';

export const ANALYTICS_BROWSER_EXCLUSION_STORAGE_KEY = 'silkilinen:analyticsExcluded';
export const ANALYTICS_BROWSER_EXCLUSION_EVENT = 'silkilinen:analytics-exclusion';

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

// THE rule for what analytics must never count. One owner, because the shop has
// TWO trackers — our own beacon (lib/track.ts -> the clickstream, funnel and
// advisor) and Vercel Analytics (components/VercelAnalytics.tsx) — and they must
// count the same population. Two trackers silently measuring different sets of
// people is worse than either alone: the disagreement stays invisible until
// someone compares them, and then neither can be trusted.
//
// They had already drifted. Vercel dropped /admin, /journal/preview and
// /preview/; our own beacon dropped only /admin, so the founder's preview
// browsing went into the clickstream that feeds the funnel and the advisor —
// exactly the pollution the Vercel filter was added to prevent.
//
// What counts as "not a customer": the admin, the preview surfaces, and the
// inline editor. The last one is the case neither tracker had, and the easiest
// to miss — ?edit=1 turns the REAL storefront into a work surface, so the paths
// look like ordinary shopping and only the query string gives it away.

// Matched after any locale prefix is stripped, so /de/journal/preview/x is
// excluded as surely as /journal/preview/x.
const EXCLUDED_PREFIXES = ['/admin', '/journal/preview'];
const EXCLUDED_SEGMENTS = ['/preview/'];

// Strip a leading /de|/fr|/it|/es so a translated page is judged on its real
// route. Reads the locale list rather than repeating it — adding a market must
// not quietly reopen a hole here.
function withoutLocale(pathname: string): string {
  const m = pathname.match(/^\/([a-z]{2})(?=\/|$)/);
  if (m && (LOCALES as readonly string[]).includes(m[1])) {
    return pathname.slice(m[0].length) || '/';
  }
  return pathname;
}

/**
 * An owner can mark one browser as internal from Session Replay. This is kept
 * locally on that browser: it must never guess from an email, account, IP or
 * order, because each of those can also belong to a genuine customer.
 */
export function isBrowserExcludedFromAnalytics(storage?: Pick<Storage, 'getItem'>): boolean {
  let reader = storage;
  if (!reader) {
    if (typeof window === 'undefined') return false;
    reader = window.localStorage;
  }
  try {
    return reader.getItem(ANALYTICS_BROWSER_EXCLUSION_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setBrowserAnalyticsExcluded(excluded: boolean, storage?: BrowserStorage): void {
  let writer = storage;
  if (!writer) {
    if (typeof window === 'undefined') return;
    writer = window.localStorage;
  }
  try {
    if (excluded) writer.setItem(ANALYTICS_BROWSER_EXCLUSION_STORAGE_KEY, 'true');
    else writer.removeItem(ANALYTICS_BROWSER_EXCLUSION_STORAGE_KEY);
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new Event(ANALYTICS_BROWSER_EXCLUSION_EVENT));
    }
  } catch {
    // Storage can be unavailable in privacy-restricted browsers. The customer
    // experience must still work, even if this owner preference cannot persist.
  }
}

export function subscribeToBrowserAnalyticsExclusion(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === ANALYTICS_BROWSER_EXCLUSION_STORAGE_KEY) callback();
  };
  window.addEventListener(ANALYTICS_BROWSER_EXCLUSION_EVENT, callback);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(ANALYTICS_BROWSER_EXCLUSION_EVENT, callback);
    window.removeEventListener('storage', onStorage);
  };
}

/**
 * Is this page the founder working rather than a customer shopping?
 *
 * @param pathname location.pathname
 * @param search   location.search (optional; needed to catch the inline editor)
 */
export function isExcludedFromAnalytics(pathname: string, search = ''): boolean {
  if (isBrowserExcludedFromAnalytics()) return true;

  const path = withoutLocale(String(pathname || ''));

  // Exact route or anything beneath it — not a bare startsWith, which would also
  // swallow a storefront page whose slug merely begins with the same letters.
  if (EXCLUDED_PREFIXES.some(p => path === p || path.startsWith(`${p}/`))) return true;
  if (EXCLUDED_SEGMENTS.some(s => path.includes(s))) return true;

  // The inline WYSIWYG editor (components/inline/InlineEdit.tsx) activates on
  // ?edit=1 over the live storefront — work, not shopping.
  if (new URLSearchParams(search).get('edit') === '1') return true;

  return false;
}
