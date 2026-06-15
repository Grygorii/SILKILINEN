'use strict';

// HMAC signature for one-click unsubscribe links. Without it, the cart-recovery
// unsubscribe took only a base64url order id — guessable (ObjectIds are
// semi-predictable) and triggerable via a prefetch, so anyone could disable
// another customer's recovery emails. Signing the id makes the link
// unforgeable. Stateless (no per-order token field needed).

const crypto = require('crypto');

function secret() {
  return process.env.UNSUBSCRIBE_SECRET || process.env.JWT_SECRET || '';
}

function sign(id) {
  return crypto.createHmac('sha256', secret()).update(String(id)).digest('hex').slice(0, 24);
}

function verify(id, sig) {
  if (typeof sig !== 'string' || !sig) return false;
  const expected = sign(id);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { sign, verify };
