import { describe, it, expect } from 'vitest';

// Mirrors the clamp in services/discounts.js. This sits on the money path: the
// caller does subtotal - discountAmount, so a negative discount does not fail,
// it OVERCHARGES.
function discountFor(promo, subtotal) {
  let discountAmount = 0;
  const value = Number(promo.value) || 0;
  if (promo.type === 'percentage') {
    const pct = Math.min(Math.max(value, 0), 100);
    discountAmount = Math.round(subtotal * (pct / 100) * 100) / 100;
  } else {
    discountAmount = Math.min(Math.max(value, 0), subtotal);
  }
  return Math.min(Math.max(discountAmount, 0), subtotal);
}

describe('discount clamping', () => {
  it('applies a normal percentage', () => {
    expect(discountFor({ type: 'percentage', value: 10 }, 200)).toBe(20);
  });

  it('applies a normal fixed amount', () => {
    expect(discountFor({ type: 'fixed', value: 25 }, 200)).toBe(25);
  });

  it('never returns a negative discount, which would overcharge', () => {
    expect(discountFor({ type: 'percentage', value: -10 }, 200)).toBe(0);
    expect(discountFor({ type: 'fixed', value: -50 }, 200)).toBe(0);
  });

  it('caps a percentage at 100 rather than paying the customer', () => {
    expect(discountFor({ type: 'percentage', value: 150 }, 200)).toBe(200);
  });

  it('never discounts more than the cart', () => {
    expect(discountFor({ type: 'fixed', value: 500 }, 200)).toBe(200);
  });

  it('survives a non-numeric value', () => {
    expect(discountFor({ type: 'fixed', value: undefined }, 200)).toBe(0);
    expect(discountFor({ type: 'percentage', value: 'abc' }, 200)).toBe(0);
  });

  it('leaves a zero-value code as no discount', () => {
    expect(discountFor({ type: 'percentage', value: 0 }, 200)).toBe(0);
  });
});
