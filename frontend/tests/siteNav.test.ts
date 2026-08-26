import { describe, it, expect } from 'vitest';
import { siteSections } from '@/lib/siteNav';

// This list existed twice and was missing from a third place: the desktop
// footer had inline columns, FooterMobileNav.tsx had its own arrays, and the
// hamburger drawer had neither — so on a phone, where the drawer IS the
// navigation, half the site could not be reached. These tests pin the shape all
// three now read.
describe('site navigation', () => {
  const sections = siteSections([{ slug: 'robes', label: 'Robes' }]);

  it('has the four sections the UI brief asks for', () => {
    expect(sections.map(s => s.title)).toEqual(['Shop', 'Discover', 'Help', 'About']);
  });

  it('puts the education pages where every page links to them', () => {
    // §68 wants the Silk Standard and the Care Guide reachable site-wide.
    const hrefs = sections.flatMap(s => s.links.map(l => l.href));
    expect(hrefs).toContain('/silk-standard');
    expect(hrefs).toContain('/care-guide');
  });

  it('builds the shop column from live categories, not a hardcoded list', () => {
    // A hardcoded list goes stale the first time a category is merged — which
    // has happened here before, nine slugs down to six.
    const shop = siteSections([{ slug: 'robes', label: 'Robes' }]).find(s => s.id === 'shop')!;
    expect(shop.links.map(l => l.href)).toContain('/shop?category=robes');
    const none = siteSections([]).find(s => s.id === 'shop')!;
    expect(none.links.some(l => l.href.includes('category='))).toBe(false);
    // The fixed entries survive an empty catalogue.
    expect(none.links.map(l => l.href)).toContain('/shop');
  });

  it('carries every section the drawer needs outside Shop', () => {
    // The drawer renders everything but Shop (it builds its own category list),
    // so an empty Discover or Help there is a dead group on a phone.
    for (const s of sections.filter(s => s.id !== 'shop')) {
      expect(s.links.length, s.title).toBeGreaterThan(0);
    }
  });

  it('keeps the cookie control on exactly one section', () => {
    expect(sections.filter(s => s.hasCookieLink)).toHaveLength(1);
  });

  it('has no duplicate destinations', () => {
    // The restructure redistributed the old "Info" and "Legal" columns; a link
    // landing in two sections is the signature of a half-finished move.
    const hrefs = sections.flatMap(s => s.links.map(l => l.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
