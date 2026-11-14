import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE = path.join(HERE, '..', 'app', 'admin', 'competitors', 'page.tsx');

describe('competitor recommendation workspace', () => {
  const source = fs.readFileSync(PAGE, 'utf8');

  it('makes the review-only boundary visible to the founder', () => {
    expect(source).toContain('Advisory only');
    expect(source).toContain('Open product for manual review');
    expect(source).toContain('Being cheaper is never the default move.');
  });

  it('shows evidence limits rather than treating broad catalogue prices as a mandate', () => {
    expect(source).toContain('currency unconfirmed');
    expect(source).toContain('Market evidence, not a price mandate');
    expect(source).toContain('Need more evidence');
  });

  it('does not contain a product price mutation from the competitor workspace', () => {
    expect(source).not.toMatch(/\/api\/admin\/products\/[^'"`]*?(?:PATCH|PUT|quick-update|bulk-discount)/i);
    expect(source).not.toContain('apply_price');
  });
});
