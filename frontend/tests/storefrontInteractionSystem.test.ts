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
    expect(hero).toContain("content: '→';");
    expect(hero).not.toContain("content: '↗';");
  });

  it('keeps selection controls quiet until selected and large enough to touch', () => {
    const option = read('components/ui/OptionPill.module.css');
    const swatch = read('components/ui/ColourSwatch.module.css');
    const options = read('components/ProductOptions.module.css');

    expect(option).toContain('min-height: var(--pill-h);');
    expect(option).toContain('background: var(--color-ink);');
    expect(swatch).toContain('width: var(--pill-h);');
    expect(swatch).toContain('outline: 1px solid var(--color-ink);');
    expect(options).toContain('width: 44px;');
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
