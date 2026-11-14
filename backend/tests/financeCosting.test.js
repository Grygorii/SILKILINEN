import { describe, expect, it } from 'vitest';
import pkg from '../services/financeCosting.js';

const {
  validateCostingInput,
  currentProductIdsForMissingCogs,
  currentCogsForOrder,
  withResolvedMissingCogs,
} = pkg;

describe('finance costing', () => {
  it('accepts only valid cost components and derives the total server-side', () => {
    const result = validateCostingInput({
      materialCost: '20.005',
      laborCost: 5,
      packagingCost: '',
      totalUnitCost: 0,
      lastUpdated: 'not trusted',
      notes: '  October supplier invoice  ',
    });

    expect(result).toEqual({
      ok: true,
      costing: {
        materialCost: 20.01,
        laborCost: 5,
        packagingCost: 0,
        totalUnitCost: 25.01,
        notes: 'October supplier invoice',
      },
    });
  });

  it('rejects invalid or negative cost input', () => {
    expect(validateCostingInput({ materialCost: -1, laborCost: 0, packagingCost: 0 }).ok).toBe(false);
    expect(validateCostingInput({ materialCost: 'not a number', laborCost: 0, packagingCost: 0 }).ok).toBe(false);
  });

  it('finds every product needed to resolve only orders missing a COGS snapshot', () => {
    const ids = currentProductIdsForMissingCogs([
      {
        costs: {},
        items: [
          { productId: 'dress' },
          { bundleId: 'set', includedProducts: [{ productId: 'brief' }, { productId: 'mask' }] },
        ],
      },
      { costs: { cogs: 12 }, items: [{ productId: 'already-captured' }] },
    ]);

    expect(ids.sort()).toEqual(['brief', 'dress', 'mask']);
  });

  it('calculates direct and bundle lines from current product costs when a historic snapshot is absent', () => {
    const costs = new Map([['dress', 20], ['brief', 6], ['mask', 4]]);
    const order = {
      items: [
        { productId: 'dress', quantity: 2 },
        { bundleId: 'set', quantity: 3, includedProducts: [{ productId: 'brief', quantity: 2 }, { productId: 'mask' }] },
      ],
    };

    expect(currentCogsForOrder(order, costs)).toBe(88);
  });

  it('fills only missing COGS and never overwrites a captured historic cost', () => {
    const orders = [
      { _id: 'missing', costs: {}, items: [{ productId: 'dress', quantity: 2 }] },
      { _id: 'captured', costs: { cogs: 11 }, items: [{ productId: 'dress', quantity: 2 }] },
    ];
    const resolved = withResolvedMissingCogs(orders, new Map([['dress', 20]]));

    expect(resolved[0].costs.cogs).toBe(40);
    expect(resolved[1].costs.cogs).toBe(11);
    expect(orders[0].costs.cogs).toBeUndefined();
  });

  it('leaves a cost unknown when one product in the order still has no costing', () => {
    const order = { costs: {}, items: [{ productId: 'dress' }, { productId: 'brief' }] };
    const [resolved] = withResolvedMissingCogs([order], new Map([['dress', 20]]));

    expect(resolved.costs.cogs).toBeUndefined();
  });
});
