import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
const read = (path: string) => readFileSync(path, 'utf8');

describe('mobile-first storefront refinement', () => {
  it('keeps a concise, product-led homepage hierarchy', () => {
    const home = read('app/(shop)/page.tsx');
    const sections = [
      '<NewArrivals />',
      '<ShippingMap />',
      '<QualityBand />',
      '<CategoryTiles content={content} />',
      '<FeaturedCollections />',
      '<ReviewsCarousel reviews={withMessage} />',
      '<NewsletterBand />',
    ];
    sections.slice(1).forEach((section, index) => {
      expect(home.indexOf(sections[index])).toBeLessThan(home.indexOf(section));
    });
    expect(home.match(/<ShippingMap \/>/g)).toHaveLength(1);
    expect(home).not.toMatch(/<StyleFinderBand|<ReassuranceRow|<StorySection|<BlogTeaser|<InstagramGrid/);
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
  it('uses an editorial hero action while keeping its tap target intact', () => {
    const css = read('app/(shop)/page.module.css');
    expect(css).not.toContain('border-bottom: 1px solid currentColor;');
    expect(css).toContain("content: '→';");
    expect(css).toContain('.heroBtn:hover::after');
    expect(css).toContain('min-height: 44px;');
    expect(read('components/ui/Button.module.css')).toContain('min-height: var(--ctrl-h-mobile)');
  });
});
