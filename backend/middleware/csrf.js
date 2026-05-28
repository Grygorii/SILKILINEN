'use strict';

// Custom-header CSRF defence. Browsers refuse to send custom headers
// on cross-origin requests without first sending a CORS preflight, and
// our CORS_ORIGINS allowlist (F9) rejects preflights from anywhere
// other than the configured origins. So requiring the header is enough
// to block a malicious third-party site from forging writes via the
// user's cookie — even when SameSite is 'none' for cross-domain
// admin/customer auth.
//
// The header value doesn't need to be a verifiable token; its mere
// presence proves the request originated from JS we control. This is
// the "custom request header" pattern that OWASP recommends as the
// simplest CSRF defence when no other token mechanism is in place.

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Paths that intentionally accept cross-origin POSTs from external
// services (Stripe, OAuth callbacks, etc) or where adding the header
// is impossible. These are protected by their own signatures or
// don't carry session cookies.
const EXEMPT_PATHS = new Set([
  '/api/webhook',           // Stripe webhook — signed by Stripe
  '/api/webhook/',
]);

const EXEMPT_PREFIXES = [
  '/api/webhook/',
];

function isExempt(req) {
  if (SAFE_METHODS.has(req.method)) return true;
  if (EXEMPT_PATHS.has(req.path)) return true;
  for (const prefix of EXEMPT_PREFIXES) {
    if (req.path.startsWith(prefix)) return true;
  }
  return false;
}

function csrf(req, res, next) {
  if (isExempt(req)) return next();
  const header = req.get('X-CSRF-Token') || req.get('X-Requested-With');
  if (!header) {
    return res.status(403).json({ error: 'Missing CSRF header. State-changing requests must include X-CSRF-Token.' });
  }
  next();
}

module.exports = { csrf };
