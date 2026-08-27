import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from '../services/sizeChart.js';

const { getSizeChart } = pkg;

// The storefront mirrors this table so the size guide is never an empty page
// and the product-page drawer has something to show before its fetch lands.
// Same bargain as the shipping fallback, same guard: the copy may exist, but it
// may not drift.
//
// It pins the frontend to the backend's DEFAULTS. A chart edited in admin makes
// the mirror stale by construction — which matters less here than for shipping,
// because the drawer and the page both prefer the live rows and only fall back
// when the API is unreachable.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIRROR = path.join(HERE, '..', '..', 'frontend', 'lib', 'sizeChart.ts');

const COLS = ['size', 'eu', 'uk', 'bustCm', 'bustIn', 'waistCm', 'waistIn', 'hipCm', 'hipIn'];

function parseMirror(src) {
  const body = src.slice(src.indexOf('FALLBACK_SIZE_ROWS'));
  return [...body.matchAll(/\{([^}]*)\}/g)].map(([, inner]) => {
    const row = {};
    for (const col of COLS) {
      const m = inner.match(new RegExp(`\\b${col}:\\s*'([^']*)'`));
      if (m) row[col] = m[1];
    }
    return row;
  }).filter(r => r.size);
}

describe('storefront size chart fallback', () => {
  const mirror = parseMirror(fs.readFileSync(MIRROR, 'utf8'));
  // No admin override is loaded in a unit test, so this is the default table.
  const defaults = getSizeChart().map(r => Object.fromEntries(COLS.map(c => [c, r[c]])));

  it('parses the mirror rather than matching nothing', () => {
    expect(mirror.length).toBeGreaterThanOrEqual(3);
  });

  it('lists the same sizes in the same order', () => {
    expect(mirror.map(r => r.size)).toEqual(defaults.map(r => r.size));
  });

  it('quotes the same measurement for every column of every row', () => {
    expect(mirror).toEqual(defaults);
  });
});
