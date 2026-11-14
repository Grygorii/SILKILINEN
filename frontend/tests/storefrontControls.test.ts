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
    expect(quickAdd).toContain('UNAVAILABLE');
  });

  it('uses a physical press state without globally fading controls', () => {
    const globals = read('app/globals.css');
    const button = read('components/ui/Button.module.css');

    expect(globals).toContain('transform: translateY(1px);');
    expect(globals).not.toContain('button:active:not(:disabled) {\n  opacity: 0.75;');
    expect(button).toContain('cursor: not-allowed;');
  });
});
