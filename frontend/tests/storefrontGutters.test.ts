import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
const read = (name: string) => readFileSync(`components/${name}.module.css`, 'utf8');
describe('storefront desktop gutters', () => {
  it('uses one bounded responsive desktop gutter for both shopping sections', () => {
    for (const name of ['NewArrivals', 'FeaturedCollections']) {
      expect(read(name)).toContain('padding: var(--s-7) clamp(var(--s-5), 3vw, var(--s-8))');
      expect(read(name)).toContain('max-width: 1920px');
    }
  });
  it('does not restore the narrow arrivals container or the nested two-collection cap', () => {
    expect(read('NewArrivals')).not.toContain('max-width: 1440px');
    expect(read('FeaturedCollections')).not.toContain('max-width: 860px');
  });
  it('preserves the mobile swipe gutter and two-card basis', () => {
    const css = read('NewArrivals');
    expect(css).toContain('padding: var(--s-6) 0 var(--s-7)');
    expect(css).toContain('padding-inline: var(--s-5)');
    expect(css).toContain('flex-basis: calc((100% - var(--s-3)) / 2)');
    expect(css).toContain('width: 44px');
    expect(css).toContain('height: 44px');
  });
  it('keeps collection images at the same ratio and mobile section padding', () => {
    const css = read('FeaturedCollections');
    expect(css).toContain('aspect-ratio: 3/2');
    expect(css).toContain('.section { padding: 60px 5%; }');
    expect(css).toContain('grid-template-columns: 1fr; gap: 24px');
  });
});
