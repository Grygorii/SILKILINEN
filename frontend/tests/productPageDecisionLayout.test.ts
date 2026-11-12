import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

describe('product page decision layout', () => {
  it('does not trap the desktop buying panel in a nested scroll area', () => {
    const css = read('app/(shop)/product/[id]/page.module.css');
    const infoRule = css.match(/\.infoCol\s*\{([\s\S]*?)\}/)?.[1] ?? '';
    expect(infoRule).not.toContain('overflow-y: auto');
    expect(infoRule).not.toContain('max-height:');
  });

  it('caps wide screens and preserves a comfortable phone purchase panel', () => {
    const css = read('app/(shop)/product/[id]/page.module.css');
    expect(css).toContain('width: min(100%, 1560px)');
    expect(css).toContain('padding: 26px 20px 88px');
    expect(css).toContain('@media (min-width: 901px) and (max-height: 820px)');
  });

  it('renders order reassurance as a labelled responsive list', () => {
    const component = read('components/ProductOptions.tsx');
    const css = read('components/ProductOptions.module.css');
    expect(component).toContain('className={styles.reassurance}');
    expect(component).toContain('aria-label="Order reassurance"');
    expect(css).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
  });
});
