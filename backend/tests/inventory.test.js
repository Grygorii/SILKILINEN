import { describe, it, expect } from 'vitest';
import pkg from '../services/inventory.js';

const { availabilityError, matchVariant, trackedTotal, basketChecker } = pkg;

// Availability is checked in priceOrder, which both /quote and /create-intent
// call — so it runs BEFORE the charge. That check existed; it had holes, and
// every hole failed in the same direction: silently allowing the sale.
//
// What makes them expensive is what happens afterwards. checkoutV2 decrements
// stock only after the order commits, and deliberately fail-soft — a stock
// write must never lose a paid order — so it CLAMPS an oversell to zero and
// logs it. Nothing rejects, nothing refunds. Whatever this function lets
// through becomes a paid order the shop cannot fill.
//
// The governing rule, and the reason several tests below assert ALLOWED: refuse
// only what can be proven unfillable. A guard that blocks a legitimate order is
// worse than the oversell it was added to prevent.

const robe = () => ({
  _id: 'p1',
  name: 'Silk Robe',
  status: 'active',
  variants: [
    { _id: 'v-s', colour: 'Sky Blue', size: 'S', stockLevel: 0 },
    { _id: 'v-m', colour: 'Sky Blue', size: 'M', stockLevel: 1 },
    { _id: 'v-l', colour: 'Sky Blue', size: 'L', stockLevel: 9 },
  ],
});
const scarf = () => ({ _id: 'p2', name: 'Silk Scarf', status: 'active', variants: [], totalStock: 2 });
const untracked = () => ({ _id: 'p3', name: 'Silk Eye Mask', status: 'active', variants: [] });

describe('matchVariant', () => {
  it('matches on colour and size exactly', () => {
    expect(matchVariant(robe().variants, 'Sky Blue', 'M')._id).toBe('v-m');
  });

  it('matches on size alone when that identifies one row', () => {
    // Colour is per-PRODUCT here, so rows usually share one colour and a line
    // may not repeat it. Requiring both meant such a line matched nothing —
    // and an unmatched line used to skip the stock check entirely.
    expect(matchVariant(robe().variants, '', 'M')._id).toBe('v-m');
  });

  it('matches on colour alone for a piece with no sizes', () => {
    const v = [{ _id: 'a', colour: 'Ivory' }, { _id: 'b', colour: 'Black' }];
    expect(matchVariant(v, 'Black', '')._id).toBe('b');
  });

  it('falls back to the only row there is', () => {
    expect(matchVariant([{ _id: 'only', size: 'One size', stockLevel: 3 }], 'Ivory', 'M')._id).toBe('only');
  });

  it('refuses to guess when the line fits no row', () => {
    expect(matchVariant(robe().variants, 'Sky Blue', 'XXL')).toBe(null);
  });
});

describe('trackedTotal', () => {
  it('sums variant stock', () => {
    expect(trackedTotal(robe())).toBe(10);
  });

  it('falls back to totalStock for a variantless piece', () => {
    expect(trackedTotal(scarf())).toBe(2);
  });

  it('reports null — untracked, NOT zero — when nothing is tracked', () => {
    // Untracked must stay buyable. Reading it as zero would quietly make every
    // loosely-managed line unsellable.
    expect(trackedTotal(untracked())).toBe(null);
    expect(trackedTotal({ variants: [], totalStock: 0 })).toBe(null);
  });

  it('ignores negative stock left by a previous oversell', () => {
    expect(trackedTotal({ variants: [{ stockLevel: -3 }, { stockLevel: 2 }] })).toBe(2);
  });
});

describe('availabilityError', () => {
  it('refuses more than a variant holds', () => {
    expect(availabilityError(robe(), { colour: 'Sky Blue', size: 'M', quantity: 5 }))
      .toMatch(/Only 1 .* left/);
  });

  it('refuses a size the piece does not come in', () => {
    // Was ALLOWED: an unmatched variant skipped the check, so a cart left open
    // across a size being withdrawn sold something that does not exist — and
    // the decrement then skipped it too, so stock never moved either.
    expect(availabilityError(robe(), { colour: 'Sky Blue', size: 'XXL', quantity: 1 }))
      .toMatch(/no longer available in XXL/);
  });

  it('refuses an oversell on a line whose colour is missing', () => {
    // Was ALLOWED: nine Mediums against one in stock.
    expect(availabilityError(robe(), { size: 'M', quantity: 9 })).toMatch(/Only 1/);
  });

  it('refuses more than a variantless piece holds', () => {
    // Was ALLOWED: the check only ran when variants existed, so a product
    // tracked by totalStock alone was never examined at all.
    expect(availabilityError(scarf(), { quantity: 50 })).toMatch(/Only 2/);
  });

  it('refuses anything sold out', () => {
    expect(availabilityError({ ...robe(), status: 'sold_out' }, { size: 'L', quantity: 1 }))
      .toMatch(/sold out/);
  });

  it('allows what is genuinely in stock', () => {
    expect(availabilityError(robe(), { colour: 'Sky Blue', size: 'L', quantity: 9 })).toBe(null);
    expect(availabilityError(robe(), { size: 'M', quantity: 1 })).toBe(null);
    expect(availabilityError(scarf(), { quantity: 2 })).toBe(null);
  });

  it('allows an untracked piece at any quantity', () => {
    expect(availabilityError(untracked(), { quantity: 5 })).toBe(null);
  });

  it('names the size it is refusing, so the message is actionable', () => {
    expect(availabilityError(robe(), { size: 'S', quantity: 1 })).toContain('(S)');
  });
});

describe('basketChecker', () => {
  it('adds up the same variant across separate lines', () => {
    // The gap: availabilityError judges one line. 1 + 1 against a stock of 1
    // passed twice. The cart UI merges identical lines, but checkout also
    // accepts `items` straight from the client.
    const check = basketChecker();
    const p = robe();
    expect(check(p, { colour: 'Sky Blue', size: 'M', quantity: 1 })).toBe(null);
    expect(check(p, { colour: 'Sky Blue', size: 'M', quantity: 1 })).toMatch(/Only 1/);
  });

  it('sees through two spellings of the same variant', () => {
    // Keyed on the resolved variant, not the line's text.
    const check = basketChecker();
    const p = robe();
    expect(check(p, { colour: 'Sky Blue', size: 'M', quantity: 1 })).toBe(null);
    expect(check(p, { colour: '', size: 'M', quantity: 1 })).toMatch(/Only 1/);
  });

  it('keeps sizes of one product apart', () => {
    const check = basketChecker();
    const p = robe();
    expect(check(p, { size: 'M', quantity: 1 })).toBe(null);
    expect(check(p, { size: 'L', quantity: 9 })).toBe(null);
  });

  it('does not claim units for a line it refused', () => {
    // A refused line must not eat stock a later, valid line needs.
    const check = basketChecker();
    const p = robe();
    expect(check(p, { size: 'L', quantity: 50 })).toMatch(/Only 9/);
    expect(check(p, { size: 'L', quantity: 9 })).toBe(null);
  });

  it('counts a bundle child against the same stock as a loose line', () => {
    // Bundle children were never checked at all, and they are decremented on
    // sale like any other line.
    const check = basketChecker();
    const p = scarf();
    expect(check(p, { quantity: 2 })).toBe(null);
    expect(check(p, { quantity: 1 })).toMatch(/Only 2/);
  });

  it('leaves untracked pieces alone however many lines ask for them', () => {
    const check = basketChecker();
    const p = untracked();
    for (let i = 0; i < 5; i++) expect(check(p, { quantity: 3 })).toBe(null);
  });
});
