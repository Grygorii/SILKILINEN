'use strict';
const crypto = require('crypto');
function normalizeEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function emailMatch(email) {
  const normalized = normalizeEmail(email);
  return normalized ? new RegExp(`^\\s*${escapeRegex(normalized)}\\s*$`, 'i') : null;
}
function ordersForCustomer(customer) {
  const clauses = [{ customerId: customer._id }];
  const email = emailMatch(customer.email);
  // Never take ownership of an order explicitly linked to somebody else.
  if (email && !customer.gdprDeletedAt) clauses.push({ customerId: null, customerEmail: email });
  return { $or: clauses };
}
function erasedEmailHash(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  if (!process.env.JWT_SECRET) throw new Error('Customer erasure fingerprint requires server signing key');
  return crypto.createHmac('sha256', process.env.JWT_SECRET).update(`customer-erasure:${normalized}`).digest('hex');
}
module.exports = { normalizeEmail, escapeRegex, emailMatch, ordersForCustomer, erasedEmailHash };
