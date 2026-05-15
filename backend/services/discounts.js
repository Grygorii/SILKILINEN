const PromoCode = require('../models/PromoCode');

/**
 * Validate a promo code against the current cart subtotal.
 * Returns { valid, code, type, value, discountAmount, error }
 */
async function validateDiscount(codeStr, subtotal) {
  if (!codeStr) return { valid: false, error: 'No code provided' };

  const promo = await PromoCode.findOne({ code: codeStr.toUpperCase().trim() });
  if (!promo || !promo.active) {
    return { valid: false, error: 'Invalid or expired discount code' };
  }

  const now = new Date();
  if (promo.validFrom && promo.validFrom > now) {
    return { valid: false, error: 'This code is not yet active' };
  }
  if (promo.validUntil && promo.validUntil < now) {
    return { valid: false, error: 'This code has expired' };
  }
  if (promo.maxUses !== null && promo.usageCount >= promo.maxUses) {
    return { valid: false, error: 'This code has reached its usage limit' };
  }
  if (promo.minOrderValue && subtotal < promo.minOrderValue) {
    return { valid: false, error: `Minimum order value €${promo.minOrderValue.toFixed(2)} required` };
  }

  let discountAmount = 0;
  if (promo.type === 'percentage') {
    discountAmount = Math.round(subtotal * (promo.value / 100) * 100) / 100;
  } else {
    discountAmount = Math.min(promo.value, subtotal);
  }

  return {
    valid: true,
    code: promo.code,
    type: promo.type,
    value: promo.value,
    discountAmount,
  };
}

/**
 * Increment usage count after successful order.
 */
async function redeemDiscount(codeStr) {
  await PromoCode.updateOne(
    { code: codeStr.toUpperCase().trim() },
    { $inc: { usageCount: 1 } }
  );
}

module.exports = { validateDiscount, redeemDiscount };
