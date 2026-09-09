import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Two questions this file answers, both of which were being answered wrongly.
//
//   1. Is every page we WANT indexed listed in the sitemap?
//      /care-guide and /style-finder were not. Both are real pages with real
//      copy and no robots directive, so they were indexable and discoverable
//      only through internal links. The six CATEGORY listings — the shop's most
//      valuable commercial-intent pages after the products — were missing too.
//
//   2. Is every page we do NOT want indexed actually blocked?
//      /account, /checkout, /success, /wishlist and /cancel carried no robots
//      directive at all. robots.txt disallows only /admin and /api, so an order
//      confirmation page was as indexable as the homepage.
//
// Neither shows up anywhere except in Search Console weeks later, which is the
// worst possible feedback loop: a page silently absent from a sitemap and a
// private page silently present in the index look identical from the code.

const ROOT = join(__dirname, '..');
const SHOP = join(ROOT, 'app', '(shop)');
const sitemap = readFileSync(join(ROOT, 'app', 'sitemap.ts'), 'utf8');

/** Static leaf routes under app/(shop) — dynamic segments are covered separately. */
function staticRoutes(): string[] {
  return readdirSync(SHOP, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('[') && !e.name.startsWith('_'))
    .filter(e => existsSync(join(SHOP, e.name, 'page.tsx')))
    .map(e => e.name);
}

/** Everything a route's own page or layout declares about robots. */
function robotsSource(route: string): string {
  return ['page.tsx', 'layout.tsx']
    .map(f => join(SHOP, route, f))
    .filter(existsSync)
    .map(f => readFileSync(f, 'utf8'))
    .join('\n');
}

// Routes that must never be indexed: a basket, a payment outcome, or something
// personal. Listed by name rather than detected, because "should this be in
// Google" is a judgement, and a new private route should have to join this list
// deliberately.
const PRIVATE = ['account', 'cancel', 'checkout', 'success', 'wishlist'];

describe('sitemap', () => {
  const routes = staticRoutes();

  it('finds the routes to check', () => {
    expect(routes.length).toBeGreaterThan(10);
  });

  it('lists every indexable static page', () => {
    const missing = routes
      .filter(r => !PRIVATE.includes(r))
      // /shop is listed as `${BASE}/shop`; each route appears as `/<name>` in a
      // template literal.
      .filter(r => !sitemap.includes(`/${r}\``))
      .filter(r => !/robots:\s*\{[^}]*index:\s*false/.test(robotsSource(r)));
    expect(missing, 'indexable, but not in the sitemap — Google finds these by internal link alone').toEqual([]);
  });

  it('keeps private routes out of the index', () => {
    const exposed = PRIVATE.filter(r => !/robots:\s*\{[^}]*index:\s*false/.test(robotsSource(r)));
    expect(exposed, 'no noindex — an order confirmation or a basket can be indexed').toEqual([]);
  });

  it('keeps private routes out of the sitemap too', () => {
    // Belt and braces: a noindex page in a sitemap is a contradiction Google
    // reports rather than resolves.
    const listed = PRIVATE.filter(r => sitemap.includes(`/${r}\``));
    expect(listed, 'private routes must not be advertised for crawling').toEqual([]);
  });

  it('builds category URLs through the URL owner', () => {
    // The canonical for a category is built from categoryPath. If the sitemap
    // spells it by hand the two can differ by an encoded space, which is how
    // "Duplicate, Google chose a different canonical" happens.
    expect(sitemap).toContain('categoryPath(slug)');
  });

  it('only lists categories that have products', () => {
    // shop/page.tsx returns a real 404 for an empty category, deliberately.
    // Listing one would put a 404 in the sitemap.
    expect(sitemap).toMatch(/count\s*\?\?\s*0\)\s*>\s*0/);
  });
});
