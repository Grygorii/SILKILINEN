import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('storefront interaction system', () => {
  it('uses a restrained hierarchy instead of one decorative button treatment', () => {
    const button = read('components/ui/Button.module.css');
    const hero = read('app/(shop)/page.module.css');

    expect(button).toContain('min-height: var(--ctrl-h-desktop);');
    expect(button).toContain('background: var(--color-ink);');
    expect(button).not.toContain('.primary::before');
    expect(button).not.toContain('.withArrow');
    expect(hero).toContain('border-bottom: 1px solid currentColor;');
    expect(hero).not.toContain("content: '→';");
    expect(hero).not.toContain("content: '↗';");
  });

  it('uses hairline editorial links instead of decorative right arrows for browsing', () => {
    const blog = read('components/BlogTeaser.tsx');
    const story = read('components/StorySection.tsx');
    const shipping = read('components/ShippingMap.tsx');
    const fabric = read('components/FabricCare.tsx');
    const quality = read('components/QualityBand.tsx');
    const journalEdit = read('components/JournalShoppingEdit.tsx');
    const arrivals = read('components/NewArrivalsCarousel.tsx');
    const finderBand = read('components/StyleFinderBand.module.css');
    const finder = read('app/(shop)/style-finder/StyleFinder.tsx');
    const finderStyles = read('app/(shop)/style-finder/page.module.css');

    expect(blog).not.toContain('Discover more →');
    expect(blog).not.toContain('Read article →');
    expect(story).not.toContain('Read our story →');
    expect(shipping).not.toContain('Delivery details <span aria-hidden="true">→</span>');
    expect(shipping).toContain('Our Etsy shop <span aria-hidden="true">↗</span>');
    expect(fabric).not.toContain('measured →');
    expect(quality).not.toContain('worth it →');
    expect(journalEdit).not.toContain('collection →');
    expect(arrivals).not.toContain('new arrivals →');
    expect(finderBand).not.toContain('.finderBtn::after');
    expect(finder).not.toContain('View piece →');
    expect(finder).not.toContain('Shop everything →');
    expect(finderStyles).not.toContain('.ctaOutline::after');
  });

  it('keeps selection controls quiet until selected and large enough to touch', () => {
    const option = read('components/ui/OptionPill.module.css');
    const swatch = read('components/ui/ColourSwatch.module.css');
    const options = read('components/ProductOptions.module.css');

    expect(option).toContain('min-height: var(--pill-h);');
    expect(option).toMatch(/\.pill\[aria-pressed='true'\]::after\s*\{[^}]*bottom:[^}]*background: var\(--color-ink\);/);
    expect(swatch).toContain('width: var(--pill-h);');
    expect(swatch).toContain('outline: 1px solid var(--color-ink);');
    expect(options).toContain('width: 44px;');
  });

  it('fades only the unavailable size text and keeps its diagonal visible', () => {
    const option = read('components/ui/OptionPill.module.css');
    const sizeButton = read('components/ui/OptionPill.tsx');

    expect(sizeButton).toContain('aria-pressed={!!selected}');
    expect(sizeButton).toContain('disabled={disabled}');
    expect(option).toContain('.pill:disabled > span { opacity: .42; }');
    expect(option).toMatch(/\.pill:disabled::after\s*\{[^}]*rotate\(-45deg\)[^}]*background: var\(--color-ink\);/);
  });

  it('uses semantic controls and safe hit areas for product, bag, and guidance utilities', () => {
    const gallery = read('components/ProductGallery.tsx');
    const cart = read('components/CartPanel.module.css');
    const guide = read('components/SizeChartDrawer.module.css');

    expect(gallery).toContain('aria-label="Zoom image"');
    expect(gallery).toContain('<button');
    expect(cart).toContain('min-width: 44px;');
    expect(cart).toContain('min-height: 44px;');
    expect(guide).toContain('width: 44px;');
    expect(guide).toContain('height: 44px;');
  });

  it('does not leave a global bounce animation on every customer control', () => {
    const globals = read('app/globals.css');
    expect(globals).not.toContain('transform: translateY(1px);');
  });

  it('keeps recovery actions as clear, calm commerce controls too', () => {
    const errorPage = read('app/(shop)/error.tsx');
    const errorStyles = read('app/(shop)/error.module.css');

    expect(errorPage).toContain('className={styles.primaryAction}');
    expect(errorPage).toContain('className={styles.secondaryAction}');
    expect(errorStyles).toContain('min-height: var(--ctrl-h-desktop);');
    expect(errorStyles).toContain('min-height: var(--ctrl-h-mobile);');
  });
});
