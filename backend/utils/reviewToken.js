'use strict';

const { createHmac } = require('node:crypto');
const jwt = require('jsonwebtoken');

const REVIEW_TOKEN_AUDIENCE = 'silkilinen:write-review';
const RECEIPT_TOKEN_AUDIENCE = 'silkilinen:order-receipt';
const REVIEW_TOKEN_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days

function emailKey(email) {
  return createHmac('sha256', process.env.JWT_SECRET)
    .update('silkilinen:order-email:')
    .update(String(email).trim().toLowerCase())
    .digest('base64url');
}

function signReviewToken({ orderId, productId, customerEmail }) {
  if (!orderId || !productId || !customerEmail) {
    throw new Error('signReviewToken requires orderId, productId, customerEmail');
  }
  return jwt.sign(
    {
      // Short field names keep the token URL-friendly.
      oid: String(orderId),
      pid: String(productId),
      emh: emailKey(customerEmail),
    },
    process.env.JWT_SECRET,
    { expiresIn: REVIEW_TOKEN_TTL_SECONDS, audience: REVIEW_TOKEN_AUDIENCE },
  );
}

function verifyToken(token, audience) {
  if (typeof token !== 'string' || !token || token.length > 2048) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      audience,
    });
  } catch {
    return null;
  }
}

function verifyReviewToken(token) {
  const payload = verifyToken(token, REVIEW_TOKEN_AUDIENCE);
  if (!payload?.oid || !payload?.pid || !(payload.emh || payload.eml)) return null;
  return {
    orderId: payload.oid,
    productId: payload.pid,
    emailKey: payload.emh,
    legacyEmail: payload.eml,
  };
}

function tokenMatchesEmail(decoded, email) {
  if (!email) return false;
  if (decoded.emailKey) return decoded.emailKey === emailKey(email);
  // Keep previously emailed review links usable until they expire.
  return decoded.legacyEmail === String(email).trim().toLowerCase();
}

function signReceiptToken(order) {
  return jwt.sign({
    oid: String(order._id),
    emh: emailKey(order.customerEmail),
    dispatch: order.shippedAt.getTime(),
    iat: Math.floor(order.reviewRequestStartedAt.getTime() / 1000),
  }, process.env.JWT_SECRET, { expiresIn: REVIEW_TOKEN_TTL_SECONDS, audience: RECEIPT_TOKEN_AUDIENCE });
}

function verifyReceiptToken(token) {
  const payload = verifyToken(token, RECEIPT_TOKEN_AUDIENCE);
  if (!payload?.oid || !/^[a-f\d]{24}$/i.test(payload.oid) || !payload.emh || !Number.isSafeInteger(payload.dispatch)) {
    return null;
  }
  return { orderId: payload.oid, emailKey: payload.emh, shippedAt: new Date(payload.dispatch) };
}

module.exports = {
  signReviewToken, verifyReviewToken, signReceiptToken, verifyReceiptToken, tokenMatchesEmail, REVIEW_TOKEN_TTL_SECONDS,
};
