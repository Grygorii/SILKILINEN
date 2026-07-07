'use strict';

// Tokenised review-request links. Each token carries one (order, product,
// email) triple and a 90-day expiry. Stateless: the JWT signature is the
// only thing that proves authenticity, so no DB lookup is needed to
// validate a click. Verified-purchase is implicit — the only way a real
// person gets a valid token is to have actually placed the order it was
// issued for. JWT_SECRET is already a required boot var (see server.js).

const jwt = require('jsonwebtoken');

const REVIEW_TOKEN_AUDIENCE = 'silkilinen:write-review';
const REVIEW_TOKEN_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days

function signReviewToken({ orderId, productId, customerEmail }) {
  if (!orderId || !productId || !customerEmail) {
    throw new Error('signReviewToken requires orderId, productId, customerEmail');
  }
  return jwt.sign(
    {
      // Short field names keep the token URL-friendly.
      oid: String(orderId),
      pid: String(productId),
      eml: String(customerEmail).toLowerCase().trim(),
    },
    process.env.JWT_SECRET,
    { expiresIn: REVIEW_TOKEN_TTL_SECONDS, audience: REVIEW_TOKEN_AUDIENCE },
  );
}

function verifyReviewToken(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    // Pin the algorithm like every other jwt.verify in the codebase — closes
    // the algorithm-confusion class rather than relying on library defaults.
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      audience: REVIEW_TOKEN_AUDIENCE,
    });
    if (!payload?.oid || !payload?.pid || !payload?.eml) return null;
    return {
      orderId: payload.oid,
      productId: payload.pid,
      customerEmail: payload.eml,
    };
  } catch {
    return null;
  }
}

module.exports = { signReviewToken, verifyReviewToken, REVIEW_TOKEN_TTL_SECONDS };
