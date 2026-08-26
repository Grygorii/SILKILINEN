import { describe, it, expect } from 'vitest';
import { shouldShowUkShipping, UK_SHIPPING } from '@/lib/ukShipping';

// The gate used to be `isUK === true`, which hid the line on every unknown —
// and unknown covers a failed /api/geo request AND any deploy without Vercel's
// x-vercel-ip-country header. A UK shopper's single biggest question about
// buying from an Irish brand was answered only when a geo lookup happened to
// succeed.
describe('shouldShowUkShipping', () => {
  it('shows for a confirmed UK visitor', () => {
    expect(shouldShowUkShipping(true, true)).toBe(true);
    // ...even before the grace period is up: we already know.
    expect(shouldShowUkShipping(true, false)).toBe(true);
  });

  it('hides for a visitor we know is somewhere else', () => {
    expect(shouldShowUkShipping(false, true)).toBe(false);
    expect(shouldShowUkShipping(false, false)).toBe(false);
  });

  it('shows when geo never answered, once we have stopped waiting', () => {
    // The failure this exists for. Showing a true, scoped sentence to someone
    // in Paris costs nothing; hiding it from someone in Manchester costs the sale.
    expect(shouldShowUkShipping(null, true)).toBe(true);
  });

  it('stays quiet while geo is still in flight', () => {
    // Otherwise the line flashes on every page for every non-UK visitor for as
    // long as the request takes.
    expect(shouldShowUkShipping(null, false)).toBe(false);
  });
});

describe('UK shipping copy', () => {
  it('scopes every line to UK ORDERS rather than to the shop', () => {
    // Dispatch is Derry OR Donegal depending on destination, so an unscoped
    // "we ship from the UK" is false about the shop. Scoping is also what makes
    // failing open safe — the line is true whoever reads it.
    for (const key of ['banner', 'badge'] as const) {
      expect(UK_SHIPPING[key], key).toMatch(/UK orders/);
    }
  });

  it('names the town on every surface', () => {
    // "From the UK" asks a British shopper to take an Irish brand's word for
    // it. "From Derry" can be checked, and checkable is the point.
    for (const key of ['banner', 'badge', 'cardBody'] as const) {
      expect(UK_SHIPPING[key], key).toContain('Derry');
    }
  });

  it('never claims the whole shop ships from the UK', () => {
    for (const [key, value] of Object.entries(UK_SHIPPING)) {
      expect(value, key).not.toMatch(/\ball orders ship from (?:the UK|Derry)/i);
    }
  });
});

// ── Every surface making the claim must name the town ──────────────────────
//
// The claim was written five ways across four files, and the two that named
// Derry were on /shipping, the page a hesitant shopper never opens. Consistency
// here is not tidiness: a customs promise that is worded differently in the
// banner, on the product page and at checkout reads as three separate half-
// remembered claims rather than one policy, and "no customs" without a reason
// is exactly the kind of assurance a shopper discounts.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) sourceFiles(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const SURFACES = [
  ...sourceFiles(join(ROOT, 'app', '(shop)')),
  ...sourceFiles(join(ROOT, 'components')),
  ...sourceFiles(join(ROOT, 'lib')),
];

// Any wording that promises a UK customer no charge at the border.
const CLAIM = /no customs|no import dut|customs[- ]free|no duties/i;

// Comments are stripped before the scan, on the same reasoning
// backend/utils/originClaims.js uses for the origin rule: a comment cannot
// reach a customer, so holding one to customer-facing wording would fail CI
// over an accurate note about the code.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(line => !/^\s*(\/\/|\*)/.test(line))
    .join('\n');
}

describe('UK customs claim', () => {
  it('scans a real set of files', () => {
    expect(SURFACES.length).toBeGreaterThan(50);
  });

  it('names Derry wherever it promises no customs', () => {
    const vague: string[] = [];
    for (const file of SURFACES) {
      const src = stripComments(readFileSync(file, 'utf8'));
      if (CLAIM.test(src) && !/Derry/.test(src)) vague.push(file.slice(ROOT.length + 1));
    }
    expect(vague, 'promise the UK no customs without saying where from').toEqual([]);
  });
});
