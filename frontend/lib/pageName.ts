import { LOCALES } from './i18n';

// The label a visit is recorded under.
//
// Visits were tracked by hand-mounting <PageTracker page="home" /> on individual
// pages, and it had only ever been added to two of them: the homepage and the
// product page. Everything else — /shop, /collections, /journal, /about,
// /checkout, /reviews, /style-finder — recorded nothing at all. The funnel's
// first stage is "Visited the site", so anyone who arrived from Google on
// /shop?category=lingerie (the shop's best-performing search page) was never
// counted as having visited, and every conversion rate below it was computed
// against a fraction of the real traffic.
//
// One tracker in the shop layout now covers every storefront route, and this is
// how it names them.

// Product pages keep their own tracker: it carries the productId, which the
// layout cannot know. Returning null here is what stops the same visit being
// recorded twice.
const OWNED_BY_PAGE = ['/product'];

/**
 * @returns a short, stable label, or null when this route must not be tracked
 *   from the layout.
 */
export function pageNameFromPath(pathname: string): string | null {
  const raw = String(pathname || '/');

  // Strip a leading market prefix so /de/shop and /shop are one page in the
  // funnel rather than two, reading the locale list rather than repeating it.
  const m = raw.match(/^\/([a-z]{2})(?=\/|$)/);
  const path = m && (LOCALES as readonly string[]).includes(m[1])
    ? raw.slice(m[0].length) || '/'
    : raw;

  if (OWNED_BY_PAGE.some(p => path === p || path.startsWith(`${p}/`))) return null;
  if (path === '/') return 'home';

  const segments = path.split('/').filter(Boolean);
  if (!segments.length) return 'home';

  // A collection or article is recorded by its KIND, not its slug: the funnel
  // counts sessions per stage, and one label per article would fragment that
  // into noise while telling us nothing the page-level events do not.
  const kind: Record<string, string> = {
    collections: 'collection',
    journal: 'journal',
    bundles: 'bundle',
  };
  if (segments.length > 1 && kind[segments[0]]) return kind[segments[0]];

  return segments[0];
}
