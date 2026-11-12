import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { packItems, parseQuantity, unpackItems } = require('../routes/checkoutV2.js');

describe('checkout metadata', () => {
  it('round-trips bundle children across Stripe metadata chunks', () => {
    const items = [{
      bundleId: 'bundle-1',
      name: 'Silk set',
      price: 120,
      quantity: 2,
      includedProducts: [
        { productId: 'product-1', name: 'Silk top', quantity: 1 },
        { productId: 'product-2', name: 'Silk brief', quantity: 1 },
      ],
    }];
    const metadata = {};

    packItems(metadata, items);

    expect(unpackItems(metadata)).toEqual(items);
  });

  it.each([1, '2', 99])('accepts an integer quantity: %s', value => {
    expect(parseQuantity(value)).toBe(Number(value));
  });

  it.each([0, 100, 1.5, '1.5', '1item', '', null, undefined])(
    'rejects an invalid quantity: %s',
    value => expect(parseQuantity(value)).toBeNull(),
  );
});
