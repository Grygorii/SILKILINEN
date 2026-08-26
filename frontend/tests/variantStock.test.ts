import { describe, it, expect } from 'vitest';
import { stockBySize, maxOrderable, ORDER_CAP } from '@/lib/variantStock';

const VARIANTS = [
  { size: 'S', stockLevel: 0 },
  { size: 'M', stockLevel: 1 },
  { size: 'L', stockLevel: 9 },
];

describe('stockBySize', () => {
  it('indexes stock by size', () => {
    expect(stockBySize(VARIANTS)).toEqual({ S: 0, M: 1, L: 9 });
  });

  it('sums rows that share a size', () => {
    expect(stockBySize([{ size: 'M', stockLevel: 2 }, { size: 'M', stockLevel: 3 }])).toEqual({ M: 5 });
  });

  it('treats missing, negative and non-numeric stock as none', () => {
    expect(stockBySize([{ size: 'M' }, { size: 'L', stockLevel: -4 }])).toEqual({ M: 0, L: 0 });
  });

  it('ignores rows with no size and survives bad input', () => {
    expect(stockBySize([{ stockLevel: 5 }, { size: '  ', stockLevel: 2 }])).toEqual({});
    expect(stockBySize(null)).toEqual({});
    expect(stockBySize(undefined)).toEqual({});
  });
});

describe('maxOrderable', () => {
  const bySize = stockBySize(VARIANTS);

  it('caps by the SELECTED size, not the total', () => {
    // The bug: total is 10, so the stepper offered 10 Mediums when there is 1.
    // Nothing downstream would have caught it — checkout takes the payment and
    // decrements afterwards.
    expect(maxOrderable(bySize, 'M', 10)).toBe(1);
    expect(maxOrderable(bySize, 'L', 10)).toBe(9);
  });

  it('returns none for a size that is out of stock or does not exist', () => {
    expect(maxOrderable(bySize, 'S', 10)).toBe(0);
    expect(maxOrderable(bySize, 'XXL', 10)).toBe(0);
  });

  it('offers the best any size could allow before one is chosen', () => {
    // Not the sum — 10 here would be the same overselling bug one step earlier.
    expect(maxOrderable(bySize, '', 10)).toBe(9);
    expect(maxOrderable(bySize, null, 10)).toBe(9);
  });

  it('falls back to the total when a piece has no variant tracking', () => {
    // Untracked is not sold out. A scarf with no variant rows must stay buyable.
    expect(maxOrderable({}, '', 4)).toBe(4);
    expect(maxOrderable({}, 'One size', null)).toBe(ORDER_CAP);
  });

  it('never exceeds the order cap however much is in stock', () => {
    expect(maxOrderable({ M: 500 }, 'M', 500)).toBe(ORDER_CAP);
    expect(maxOrderable({}, '', 500)).toBe(ORDER_CAP);
  });
});
