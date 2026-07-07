const PromoCode = require('../models/PromoCode');
const PromoCodeRedemption = require('../models/PromoCodeRedemption');

/**
 * Validate a promo code against the current cart subtotal and optional customer email.
 * Returns { valid, code, type, value, discountAmount, error }
 */
async function validateDiscount(codeStr, subtotal, customerEmail) {
  if (!codeStr) return { valid: false, error: 'No code provided' };

  const promo = await PromoCode.findOne({ code: codeStr.toUpperCase().trim() });
  if (!promo) return { valid: false, error: 'This code doesn\'t exist.' };

  // Resolve active state: `status` wins over legacy `active` boolean
  const isActive = promo.status ? promo.status === 'active' : promo.active;
  if (!isActive) {
    const statusLabel = promo.status || (promo.active ? 'active' : 'paused');
    if (statusLabel === 'expired') return { valid: false, error: 'This code has expired.' };
    if (statusLabel === 'draft')   return { valid: false, error: 'This code is not yet active.' };
    return { valid: false, error: 'This code is not currently active.' };
  }

  const now = new Date();
  if (promo.validFrom && promo.validFrom > now) {
    return { valid: false, error: 'This code is not yet active.' };
  }
  if (promo.validUntil && promo.validUntil < now) {
    return { valid: false, error: 'This code has expired.' };
  }

  // Check global cap (maxUses / capped_total redemptionType)
  const effectiveMax = promo.redemptionType === 'capped_total'
    ? promo.maxUses
    : promo.maxUses; // legacy field fallback
  if (effectiveMax !== null && promo.usageCount >= effectiveMax) {
    return { valid: false, error: 'This code has reached its redemption limit.' };
  }

  // Per-customer single-use check (only when email is known)
  const isPerCustomer = promo.redemptionType === 'single_use_per_customer'
    || (promo.redemptionType === null && promo.maxUsesPerCustomer === 1);
  if (isPerCustomer && customerEmail) {
    const prior = await PromoCodeRedemption.findOne({
      promoCodeId: promo._id,
      customerEmail: customerEmail.toLowerCase().trim(),
    });
    if (prior) {
      return { valid: false, error: 'You\'ve already used this code.' };
    }
  }

  if (promo.minOrderValue && subtotal < promo.minOrderValue) {
    return { valid: false, error: `Minimum order value €${promo.minOrderValue.toFixed(2)} required.` };
  }

  // Calculate discount (appliesTo: 'all' is the only mode for now — specific_products needs cart items)
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
 * Record a redemption and increment usage count after a successful order.
 * Idempotent: won't double-count if called twice for the same order.
 */
async function redeemDiscount(codeStr, { orderId, orderNumber, customerEmail, discountAmount, session } = {}) {
  const promo = await PromoCode.findOne({ code: codeStr.toUpperCase().trim() }).session(session || null);
  if (!promo) return;

  // Guard: skip if this order was already recorded (webhook retry safety)
  if (orderId) {
    const existing = await PromoCodeRedemption.findOne({ promoCodeId: promo._id, orderId }).session(session || null);
    if (existing) return;
  }

  // Atomic, cap-aware increment: only bump usageCount while it's still below
  // maxUses, so two concurrent redemptions can't both push it past the cap the
  // way the old unconditional $inc could under a race. We deliberately do NOT
  // throw on a cap miss — this runs inside the order-creation transaction and
  // the customer has already paid the discounted amount, so aborting would lose
  // a paid order. Instead we still record the redemption and log for manual
  // reconciliation. The real over-redemption prevention lives here as damage
  // limiting; validateDiscount is the first-line check.
  const hasCap = promo.maxUses !== null && promo.maxUses !== undefined;
  const incResult = await PromoCode.updateOne(
    hasCap
      ? { _id: promo._id, $expr: { $lt: ['$usageCount', '$maxUses'] } }
      : { _id: promo._id },
    { $inc: { usageCount: 1 } },
    { session: session || null }
  );
  if (hasCap && incResult.modifiedCount === 0) {
    console.warn(`[discounts] promo ${promo.code} redeemed past its cap (order ${orderNumber || orderId}) — reconcile manually`);
  }

  if (orderId) {
    await PromoCodeRedemption.create(
      [{
        promoCodeId:   promo._id,
        code:          promo.code,
        orderId,
        orderNumber:   orderNumber || '',
        customerEmail: customerEmail ? customerEmail.toLowerCase().trim() : '',
        discountAmount: discountAmount || 0,
      }],
      { session: session || null }
    );
  }
}

module.exports = { validateDiscount, redeemDiscount };
