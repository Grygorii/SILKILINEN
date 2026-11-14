import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('account interaction system', () => {
  it('keeps account forms and primary actions large, calm, and stateful', () => {
    const css = read('app/(shop)/account/account.module.css');

    expect(css).toContain('min-height: 48px;');
    expect(css).toContain('min-height: var(--ctrl-h-desktop);');
    expect(css).toContain('.saveBtn:active:not(:disabled)');
    expect(css).toContain('.reorderBtn:active');
    expect(css).toContain('min-height: 44px;');
  });

  it('announces account form outcomes and prevents duplicate submission', () => {
    const profile = read('app/(shop)/account/profile/page.tsx');
    const addresses = read('app/(shop)/account/addresses/page.tsx');
    const signIn = read('app/(shop)/account/sign-in/page.tsx');

    expect(profile).toContain('role="status"');
    expect(addresses).toContain('role="status"');
    expect(profile).toContain('aria-busy={saving}');
    expect(addresses).toContain('aria-busy={saving}');
    expect(signIn).toContain('aria-busy={loading}');
  });

  it('uses a text-led empty-state action instead of a second competing purchase button', () => {
    const css = read('app/(shop)/account/account.module.css');
    const wishlist = read('app/(shop)/wishlist/page.tsx');

    expect(css).toContain('.emptyState a {');
    expect(css).toContain('text-decoration: underline;');
    expect(wishlist).not.toContain('Browse the collection →');
  });
});
