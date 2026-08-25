import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from '../utils/originClaims.js';

const { findOriginClaims, isOriginSafe } = pkg;

// ADR 0008 decided this in June 2026 and the code was corrected then. By
// August the claims were back: five product descriptions in seed.js said "Made
// in Ireland", a script written afterwards put it into a live collection
// description, and the About page said "We produce in small runs".
//
// Nothing had failed — there was nothing to fail. The rule lived in prose, in
// three markdown files, and prose does not run in CI. That is what this file
// changes.

// The rule bans an IDEA, not a place. "Ireland" and "Donegal" are not dirty
// words — the brand is Irish-founded, Sabreena designs the pieces in Donegal,
// and orders ship from Ireland. All three stay true however the making is
// sourced, and all three are meant to be USED. What is forbidden is the claim
// that the range is manufactured there.
//
// This block is the positive half of the rule, pinned so that tightening a
// manufacture pattern later cannot quietly take a true sentence with it.
describe('what the brand may say', () => {
  const TRUE_OF_THE_BRAND = [
    'Founded in Ireland',
    'An Irish-founded brand',
    'Designed in Ireland',
    'Designed in Donegal',
    'Designed in Ireland, inspired by the Atlantic coast',
    'European design',
    'Shipped from Ireland',
    'We ship from Donegal, Ireland worldwide',
    'An Irish silk & linen brand, based in Donegal',
    'Born in Donegal, worn across the world',
    'Inspired by the cliffs of Slieve League',
  ];

  it.each(TRUE_OF_THE_BRAND)('allows "%s"', phrase => {
    expect(findOriginClaims(phrase)).toEqual([]);
  });

  // The line runs between DESIGN and MAKING, and it is one word wide.
  it('draws the line at making, not at the place', () => {
    expect(isOriginSafe('Designed in Donegal')).toBe(true);
    expect(isOriginSafe('Designed and crafted in Donegal')).toBe(false);
    expect(isOriginSafe('Designed in Donegal, made in Ireland')).toBe(false);
    // Design in Ireland is compatible with making anywhere, which is the whole
    // point of keeping it sayable.
    expect(isOriginSafe('Designed in Donegal, made by our partners in Suzhou')).toBe(true);
  });
});

describe('the rule', () => {
  it('allows what is true of the brand however it sources', () => {
    for (const ok of [
      'An Irish silk & linen brand, based in Donegal',
      'SILKILINEN is an Irish brand based in Donegal',
      'Born in Donegal, worn across the world',
      'Founded in Ireland',
      'We ship from Donegal, Ireland worldwide',
      'An Irish-founded brand',
    ]) {
      expect(findOriginClaims(ok), ok).toEqual([]);
    }
  });

  // The false positive that would get this guard switched off: the ONE
  // sentence the brand is supposed to use contains the words "Irish silk".
  it('does not fire on the approved brand line', () => {
    expect(isOriginSafe('An Irish silk & linen brand, based in Donegal')).toBe(true);
    // But the same two words about the PRODUCT are exactly the claim.
    expect(isOriginSafe('Our Irish silk is woven for longevity')).toBe(false);
  });

  it('catches a country of manufacture stated for the whole range', () => {
    const [claim] = findOriginClaims('19 momme silk shirt with buttoned cuffs. Made in Ireland.');
    expect(claim.id).toBe('made-in');
    expect(claim.why).toMatch(/Product\.origin/);
  });

  it('catches the softer wording too, which is how it came back', () => {
    // ADR 0008 explicitly forbids swapping a blanket claim for a gentler one.
    expect(isOriginSafe('A celebration of travel and memories, crafted in Ireland.')).toBe(false);
    expect(isOriginSafe('Every piece is designed and crafted in Donegal')).toBe(false);
    expect(isOriginSafe('Irish craftsmanship in every seam')).toBe(false);
  });

  it('catches claims about how, not just where', () => {
    expect(isOriginSafe('Handmade silk robes')).toBe(false);
    expect(isOriginSafe('hand-finished edges')).toBe(false);
    expect(isOriginSafe('We produce in small runs')).toBe(false);
    expect(isOriginSafe('Our production runs in small batches')).toBe(false);
    expect(isOriginSafe('Each piece is made in small batches')).toBe(false);
  });

  it('says why, because the message is what the founder reads', () => {
    const [claim] = findOriginClaims('We produce in small runs');
    expect(claim.why).toBeTruthy();
    expect(claim.why.length).toBeGreaterThan(20);
  });

  it('does not fire on "we make every effort", which is a returns disclaimer', () => {
    // A real sentence in terms/page.tsx. An earlier draft of the production
    // pattern flagged it — the kind of false positive that gets a guard
    // switched off rather than fixed.
    expect(isOriginSafe('We make every effort to display product colours accurately')).toBe(true);
    // The same shape with a product noun IS the claim.
    expect(isOriginSafe('We make every garment ourselves')).toBe(false);
  });

  it('treats comments as not-copy only when asked', () => {
    const src = '// was: made in Ireland\nconst d = "Silk for the morning of";';
    expect(findOriginClaims(src, { code: true })).toEqual([]);
    // Default mode is for a single stored string, where nothing is a comment.
    expect(findOriginClaims(src).length).toBe(1);
    // A real string in source is still caught in code mode.
    expect(findOriginClaims('const d = "Made in Ireland";', { code: true })).toHaveLength(1);
  });

  it('is quiet on ordinary copy', () => {
    expect(isOriginSafe('')).toBe(true);
    expect(isOriginSafe(null)).toBe(true);
    expect(isOriginSafe('Bias cut silk slip dress with adjustable straps.')).toBe(true);
    expect(isOriginSafe('Free shipping over €150 · 14-day returns')).toBe(true);
  });
});

// ── The scan ──
//
// Scoped to where a HUMAN authors customer-facing copy. The AI agents are
// guarded separately and better — eight of their system prompts forbid origin
// claims in the prompt itself — and scanning them here would only produce
// false positives, since a prompt that says NEVER SAY "made in Ireland"
// contains the string it forbids.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

const SCAN = [
  'frontend/app/(shop)',
  'frontend/components',
  'backend/scripts',
  'backend/seed.js',
];

// Only two files hold banned phrases in live code rather than in comments: the
// rule itself and this test. Everything else that mentions them — the
// migration, the audit — was able to move the mention into a comment or read
// the shared rule, which is the better outcome than an exemption list that
// grows until it covers the thing being guarded.
const EXEMPT = [
  'backend/utils/originClaims.js',
  'backend/tests/originClaims.test.js',
];

function walk(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return [];
  if (fs.statSync(abs).isFile()) return [rel];
  return fs.readdirSync(abs).flatMap(entry => walk(path.join(rel, entry)));
}

const FILES = SCAN.flatMap(walk)
  .filter(f => /\.(ts|tsx|js|jsx)$/.test(f))
  .filter(f => !EXEMPT.includes(f));

describe('customer-facing copy in the repo', () => {
  it('has files to scan (a scan of nothing passes forever)', () => {
    // The failure mode of every path-based guard: a directory gets renamed,
    // the glob matches zero files, and the check goes green having read
    // nothing at all.
    expect(FILES.length).toBeGreaterThan(50);
  });

  it('makes no forbidden origin claim', () => {
    const offences = [];
    for (const file of FILES) {
      const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
      // `code: true` — comments are not copy, so a migration may document the
      // claim it removes and this rule may explain itself.
      for (const claim of findOriginClaims(text, { code: true })) {
        offences.push(`${file} — "${claim.match}" (${claim.id}): ${claim.why}`);
      }
    }
    expect(offences).toEqual([]);
  });
});
