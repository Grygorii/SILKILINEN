'use strict';

// THE order arithmetic: subtotal in, every money figure out.
//
// It was ~30 lines in the middle of priceOrder() in routes/checkoutV2.js, which
// is a 150-line async function that also loads carts, validates products against
// live stock and re-checks promo codes. So the most consequential maths in the
// shop — the numbers a customer is shown and then charged — could not be tested
// without stubbing five models and Stripe, and had no tests at all.
//
// Extracted with NO behaviour change: same order of operations, same rounding,
// same fields. priceOrder still owns everything that touches the database; this
// owns only the arithmetic, which is the part that is pure and therefore the part
// worth pinning.
//
// Deliberately NOT included here: currency conversion. EUR is canonical for all
// order economics and converting happens only at display and at the Stripe
// charge (see orderSummaryOf), so these figures are always EUR.

const { calculateShipping } = require('./shipping');
const { calculateTax } = require('./tax');

/**
 * @param {object} p
 * @param {number} p.subtotal                 sum of line prices × quantities, from DB prices
 * @param {number} p.collectionDiscountAmount order-level sale from discounted collections
 * @param {string|null} p.discountCode        a promo code that already VALIDATED
 * @param {number} p.discountAmount           that code's amount (already clamped by services/discounts)
 * @param {string} p.country                  shipping destination, for rate + tax
 */
function computeTotals({ subtotal, collectionDiscountAmount = 0, discountCode = null, discountAmount = 0, country }) {
  let code = discountCode;
  let amount = discountAmount;

  // Collection sale vs promo code: NOT stacked — the customer gets the better of
  // the two, and a winning sale must not consume a single-use code, so the code
  // is dropped rather than recorded as applied. Getting this backwards would
  // either double-discount the order or silently burn a customer's one use.
  if (collectionDiscountAmount > amount) {
    amount = collectionDiscountAmount;
    code = null;
  }

  // Never let a discount exceed the cart. services/discounts.js already clamps
  // (a negative PromoCode.value once made `subtotal - discountAmount` LARGER
  // than the cart — a typo became an overcharge), but the collection sale
  // arrives from a different path and this is the last point before a charge.
  const discountedSubtotal = Math.max(0, subtotal - amount);

  // Shipping is charged on the DISCOUNTED subtotal, so a discount that drops the
  // order under the free-shipping threshold correctly reinstates the fee.
  const shipping = calculateShipping(country, discountedSubtotal);
  const tax = calculateTax(discountedSubtotal, country);

  // Tax is NOT added: EU B2C prices are VAT-inclusive, so it is reported for the
  // order record rather than charged on top. Adding it here would overcharge
  // every customer by the VAT amount.
  const total = discountedSubtotal + shipping.cost;

  return { discountCode: code, discountAmount: amount, discountedSubtotal, shipping, tax, total };
}

module.exports = { computeTotals };
