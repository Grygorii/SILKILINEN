import { describe, it, expect } from 'vitest';
import { footerSections } from '@/lib/footerNav';

// The footer existed twice — inline columns in Footer.tsx and a separate set of
// arrays in FooterMobileNav.tsx — so a phone and a desktop could offer the same
// visitor different links. These tests pin the shape both now read.
describe('footer navigation', () => {
  const sections = footerSections([{ slug: 'robes', label: 'Robes' }]);

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
    const shop = footerSections([{ slug: 'robes', label: 'Robes' }]).find(s => s.id === 'shop')!;
    expect(shop.links.map(l => l.href)).toContain('/shop?category=robes');
    const none = footerSections([]).find(s => s.id === 'shop')!;
    expect(none.links.some(l => l.href.includes('category='))).toBe(false);
    // The fixed entries survive an empty catalogue.
    expect(none.links.map(l => l.href)).toContain('/shop');
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
