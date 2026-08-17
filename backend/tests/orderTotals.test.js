import { describe, it, expect } from 'vitest';
import pkg from '../services/orderTotals.js';
import shippingPkg from '../services/shipping.js';
import checkoutPkg from '../routes/checkoutV2.js';

// The most consequential arithmetic in the shop: these are the numbers a customer
// is shown at /quote and then charged at /create-intent. It had NO tests, because
// it lived inside a 150-line async function that also loads carts and validates
// stock, so testing it meant stubbing five models and Stripe.
//
// It was also written TWICE — priceOrder and the intent-update path each had their
// own copy — so a change to the rules had to be made in both, and the totals shown
// could drift from the totals charged. Both now call this.
const { computeTotals } = pkg;
const { calculateShipping } = shippingPkg;
const { bestCollectionDiscount } = checkoutPkg;

// Read the real threshold rather than hardcoding 150: services/shipping.js is the
// ONE source for rates, and a test that repeats the number is a second source.
const IE = 'IE';
const freeAt = (() => {
  for (let v = 0; v <= 1000; v += 5) if (calculateShipping(IE, v).isFree) return v;
  return null;
})();

const base = { subtotal: 100, country: IE };

describe('order totals', () => {
  it('adds shipping to the discounted subtotal', () => {
    const t = computeTotals(base);
    expect(t.total).toBe(t.discountedSubtotal + t.shipping.cost);
  });

  it('does NOT add tax — EU prices are VAT-inclusive', () => {
    // Adding it would overcharge every customer by the VAT amount.
    const t = computeTotals({ ...base, subtotal: 200 });
    expect(t.tax).toBeDefined();
    expect(t.total).toBe(t.discountedSubtotal + t.shipping.cost);
  });

  describe('a sale and a promo code never stack', () => {
    it('keeps the promo code when it beats the sale', () => {
      const t = computeTotals({ ...base, discountCode: 'WELCOME10', discountAmount: 30, collectionDiscountAmount: 10 });
      expect(t.discountAmount).toBe(30);
      expect(t.discountCode).toBe('WELCOME10');
    });

    it('takes the sale when it is better, and does not consume the code', () => {
      // Recording the code as applied would burn a single-use code the customer
      // never got the benefit of.
      const t = computeTotals({ ...base, discountCode: 'WELCOME10', discountAmount: 10, collectionDiscountAmount: 40 });
      expect(t.discountAmount).toBe(40);
      expect(t.discountCode).toBeNull();
    });

    it('never applies both', () => {
      const t = computeTotals({ ...base, discountCode: 'X', discountAmount: 20, collectionDiscountAmount: 25 });
      expect(t.discountAmount).toBe(25);
      expect(t.discountedSubtotal).toBe(75);
    });

    it('prefers the code on an exact tie, so the customer keeps the better record', () => {
      const t = computeTotals({ ...base, discountCode: 'X', discountAmount: 20, collectionDiscountAmount: 20 });
      expect(t.discountAmount).toBe(20);
      expect(t.discountCode).toBe('X');
    });
  });

  describe('a discount can never increase the total', () => {
    it('clamps a discount larger than the cart to the cart', () => {
      const t = computeTotals({ ...base, subtotal: 50, discountAmount: 80, discountCode: 'TOOBIG' });
      expect(t.discountedSubtotal).toBe(0);
      expect(t.total).toBeGreaterThanOrEqual(0);
    });

    it('cannot be made negative by a negative amount', () => {
      // A negative PromoCode.value once made `subtotal - discountAmount` LARGER
      // than the cart: a typo became an overcharge. discounts.js clamps, but the
      // collection sale arrives by another path, so this is the last line.
      const t = computeTotals({ ...base, subtotal: 100, collectionDiscountAmount: -50 });
      expect(t.discountedSubtotal).toBeLessThanOrEqual(100);
      expect(t.total).toBeLessThanOrEqual(100 + t.shipping.cost);
    });
  });

  describe('shipping is charged on the discounted subtotal', () => {
    it('reinstates the fee when a discount drops the order below the threshold', () => {
      expect(freeAt).not.toBeNull();
      const justFree = computeTotals({ subtotal: freeAt, country: IE });
      expect(justFree.shipping.isFree).toBe(true);

      // Same cart, discounted under the threshold: shipping must come back, or a
      // code would quietly buy free delivery too.
      const discounted = computeTotals({ subtotal: freeAt, country: IE, discountCode: 'C', discountAmount: 20 });
      expect(discounted.shipping.isFree).toBe(false);
      expect(discounted.shipping.cost).toBeGreaterThan(0);
    });
  });

  it('is deterministic — the same inputs give the same money twice', () => {
    // /quote and /create-intent call this separately; if it were not pure, the
    // totals shown and the totals charged could differ.
    const args = { ...base, subtotal: 137.5, discountCode: 'C', discountAmount: 12.34, collectionDiscountAmount: 5 };
    expect(computeTotals(args)).toEqual(computeTotals(args));
  });

  it('does not mutate its input', () => {
    const args = { ...base, discountCode: 'C', discountAmount: 10, collectionDiscountAmount: 40 };
    const copy = { ...args };
    computeTotals(args);
    expect(args).toEqual(copy);
  });
});

// The rule that picks WHICH sale a product gets. It used to run a
// Collection.find() per cart line, awaited inside the item loop, so it could not
// be tested without a database and cost one round trip per basket item on the two
// endpoints in front of "Continue to payment". Now pure, given a preloaded map.
describe('best collection discount', () => {
  const map = new Map([['a', 10], ['b', 25], ['c', 0]]);

  it('gives the customer the biggest sale when a product sits in several', () => {
    expect(bestCollectionDiscount(['a', 'b'], map)).toBe(25);
    expect(bestCollectionDiscount(['b', 'a'], map)).toBe(25); // order must not matter
  });

  it('ignores collections that are not on sale or not loaded', () => {
    // The map holds only ACTIVE, discounted collections, so an id that is missing
    // is an archived or full-price collection and must contribute nothing.
    expect(bestCollectionDiscount(['c'], map)).toBe(0);
    expect(bestCollectionDiscount(['unknown'], map)).toBe(0);
    expect(bestCollectionDiscount(['unknown', 'a'], map)).toBe(10);
  });

  it('returns 0 for a product in no collections', () => {
    expect(bestCollectionDiscount([], map)).toBe(0);
    expect(bestCollectionDiscount(undefined, map)).toBe(0);
    expect(bestCollectionDiscount(null, map)).toBe(0);
  });

  it('matches ObjectId values by string, not identity', () => {
    // product.collections holds ObjectIds; the map is keyed by String(_id).
    const oid = { toString: () => 'b' };
    expect(bestCollectionDiscount([oid], map)).toBe(25);
  });
});
