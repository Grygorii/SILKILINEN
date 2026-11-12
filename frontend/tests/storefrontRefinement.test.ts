import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
const read = (path: string) => readFileSync(path, 'utf8');

describe('mobile-first storefront refinement', () => {
  it('keeps product discovery ahead of the map, and the map ahead of the brand story', () => {
    const home = read('app/(shop)/page.tsx');
    expect(home.indexOf('<NewArrivals />')).toBeLessThan(home.indexOf('<ShippingMap />'));
    expect(home.indexOf('<ShippingMap />')).toBeLessThan(home.indexOf('<StorySection'));
    expect(home.match(/<ShippingMap \/>/g)).toHaveLength(1);
  });
  it('does not turn country or mode selection into a permanent playback pause', () => {
    const map = read('components/ShippingMap.tsx');
    expect(map).toContain('const [paused, setPaused] = useState(false)');
    expect(map).not.toContain('setPaused(true)');
    expect(map).toContain('setPaused(current => !current)');
    expect(map).toContain('svg?.pauseAnimations()');
    expect(map).toContain('svg?.unpauseAnimations()');
  });
  it('keeps optional playback and focus-safe destination selection', () => {
    const map = read('components/ShippingMap.tsx');
    expect(map).toContain('prefers-reduced-motion');
    expect(map).toContain('visibilitychange');
    expect(map).toContain('if (!running || selectFocused) return');
    expect(map).toContain('aria-pressed={paused}');
  });
  it('uses existing palette and control tokens, without a map SDK or a new font', () => {
    const css = read('components/ShippingMap.module.css');
    expect(css).toContain('background: var(--color-bg)');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).toContain('min-height: 44px');
    expect(css).toContain('var(--font-cormorant)');
    expect(read('components/ShippingMap.tsx')).toContain('/maps/shipping-world.svg');
  });
  it('keeps the product photograph free of decorative shimmer', () => {
    const css = read('components/ProductCard.module.css');
    expect(css).toContain('.sheen { display: none; }');
    expect(css).not.toContain('@keyframes sheenSweep');
    expect(css).not.toContain('@keyframes badgeShimmer');
  });
  it('keeps hero button hover from shifting its label or position', () => {
    const css = read('app/(shop)/page.module.css');
    const hover = css.slice(css.indexOf('.heroBtn:hover'), css.indexOf('.heroBtn:focus-visible'));
    expect(hover).not.toMatch(/letter-spacing|transform|box-shadow/);
    expect(read('components/ui/Button.module.css')).toContain('min-height: var(--ctrl-h-mobile)');
  });
});
