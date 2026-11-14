import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

describe('storefront control contracts', () => {
  it('makes unavailable product choices and in-progress add-to-bag actions native-disabled', () => {
    const options = read('components/ProductOptions.tsx');
    const swatch = read('components/ui/ColourSwatch.tsx');

    expect(options).toContain("disabled={addState === 'adding'}");
    expect(swatch).toContain('disabled={swatch.soldOut}');
  });

  it('keeps mobile quick add within the same tracked stock as the product page', () => {
    const quickAdd = read('components/QuickAddSheet.tsx');

    expect(quickAdd).toContain('const canAdd = !needsColour && !needsSize && maxQty > 0;');
    expect(quickAdd).toContain('disabled={soldOut}');
    expect(quickAdd).toContain('copy.product.soldOut.toUpperCase()');
  });

  it('keeps controls composed instead of applying one physical press animation everywhere', () => {
    const globals = read('app/globals.css');
    const button = read('components/ui/Button.module.css');

    expect(globals).not.toContain('transform: translateY(1px);');
    expect(button).toContain('cursor: not-allowed;');
  });

  it('keeps cart thumbnails constrained when ProductImage CSS loads afterwards', () => {
    const cart = read('components/CartPanel.module.css');
    const panel = read('components/CartPanel.tsx');

    // ProductImage's wrapper deliberately fills its parent. A dedicated outer
    // box avoids asking two CSS modules to size the same element, which made
    // the product details overflow out of the mobile drawer.
    expect(panel).toContain('<div className={styles.itemImg}>');
    expect(panel).not.toContain('wrapClassName={styles.itemImg}');
    expect(cart).toMatch(/\.itemImg\s*\{[\s\S]*?flex:\s*0 0 80px;/);
    expect(cart).toMatch(/@media \(max-width: 480px\)[\s\S]*?\.itemImg\s*\{[\s\S]*?flex-basis:\s*64px;/);
  });

  it('does not overwrite a saved bag before cart hydration has completed', () => {
    const cartContext = read('context/CartContext.tsx');

    expect(cartContext).toContain('const [hydrated, setHydrated] = useState(false);');
    expect(cartContext).toMatch(/useEffect\(\(\) => \{\s*if \(!hydrated\) return;\s*localStorage\.setItem\('cart', JSON\.stringify\(cart\)\);\s*\}, \[cart, hydrated\]\);/);
  });

  it('keeps first-time mobile purchase controls usable above cookie consent', () => {
    const sticky = read('components/StickyBuyBar.tsx');
    const stickyCss = read('components/StickyBuyBar.module.css');
    const cartCss = read('components/CartPanel.module.css');
    const quickAddCss = read('components/QuickAddSheet.module.css');

    expect(sticky).toContain('if (colours.length <= 1 && sizes.length <= 1)');
    expect(stickyCss).toContain('bottom: var(--cookie-bar-h, 0px);');
    expect(stickyCss).toContain('bottom: calc(var(--sticky-buy-h, 0px) + var(--cookie-bar-h, 0px));');
    expect(cartCss).toContain('z-index: 10001;');
    expect(quickAddCss).toContain('z-index: 10000;');
  });

  it('gives primary buttons a visible touch press state', () => {
    const button = read('components/ui/Button.module.css');

    expect(button).toMatch(/\.primary:active:not\(:disabled\)\s*\{[\s\S]*?background:\s*var\(--color-ink-muted\);/);
  });

  it('keeps purchase controls plain and gives editorial links a restrained hairline', () => {
    const button = read('components/ui/Button.tsx');
    const buttonCss = read('components/ui/Button.module.css');
    const hero = read('app/(shop)/page.module.css');

    expect(button).not.toContain('showArrow');
    expect(buttonCss).not.toContain('.withArrow');
    expect(buttonCss).not.toContain('.primary::before');
    expect(hero).toContain('border-bottom: 1px solid currentColor;');
    expect(hero).not.toContain("content: '→';");
    expect(hero).not.toContain("content: '↗';");
  });
});
