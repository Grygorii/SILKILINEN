'use strict';

/**
 * Mask an email for logs / admin display.
 * "sabreena@silkilinen.com" → "s***@silkilinen.com"
 *
 * Used by auth failure logs, admin customer list, and anywhere else
 * customer/admin emails could land in non-secure log storage. Not a
 * security boundary — just a privacy-hygiene helper to avoid splattering
 * plaintext addresses across Railway log retention.
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const at = email.indexOf('@');
  if (at < 1) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  return `${local[0]}***@${domain}`;
}

module.exports = { maskEmail };
