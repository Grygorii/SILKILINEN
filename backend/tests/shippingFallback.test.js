import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from '../services/shipping.js';

const { getEffectiveRates } = pkg;

// services/shipping.js is the ONE source of rates. The storefront's shipping
// page reads them over /api/shipping — except when it can't, and then it falls
// back to its own copy of the numbers.
//
// That copy is the exact shape of the bug PROJECT_MAP records: duplicated rates
// once told Google free shipping at €250/€200/€300 while checkout gave it at
// €150, which invalidates a merchant listing. It is tolerated here because a
// shipping page with no rates is worse than one showing last-known figures —
// but only while something checks the two still agree. This is that something.
//
// Note what this can and cannot do. It pins the fallback to the backend's
// DEFAULTS. Live rates are defaults plus admin overrides, so the moment a rate
// is edited in the admin this copy is out of date and no test can know. That is
// why the page states the figures are indicative whenever it falls back.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FALLBACK_FILE = path.join(HERE, '..', '..', 'frontend', 'lib', 'shippingFallback.ts');

function parseFallback(src) {
  const rows = [...src.matchAll(
    /\{\s*label:\s*'([^']+)',\s*cost:\s*([\d.]+),\s*freeThreshold:\s*([\d.]+),\s*deliveryMin:\s*(\d+),\s*deliveryMax:\s*(\d+)\s*\}/g,
  )];
  return rows.map(([, label, cost, freeThreshold, deliveryMin, deliveryMax]) => ({
    label,
    cost: Number(cost),
    freeThreshold: Number(freeThreshold),
    deliveryMin: Number(deliveryMin),
    deliveryMax: Number(deliveryMax),
  }));
}

describe('storefront shipping fallback', () => {
  const fallback = parseFallback(fs.readFileSync(FALLBACK_FILE, 'utf8'));
  const defaults = getEffectiveRates().map(t => ({
    label: t.label,
    cost: t.defaults.cost,
    freeThreshold: t.defaults.freeThreshold,
    deliveryMin: t.defaults.deliveryMin,
    deliveryMax: t.defaults.deliveryMax,
  }));

  it('parses the fallback rather than matching nothing', () => {
    // Without this the comparison below could pass on two empty arrays.
    expect(fallback.length).toBeGreaterThanOrEqual(4);
  });

  it('covers every region the backend defines, in the same order', () => {
    expect(fallback.map(t => t.label)).toEqual(defaults.map(t => t.label));
  });

  it('quotes the same cost, threshold and delivery window as the backend', () => {
    expect(fallback).toEqual(defaults);
  });
});
