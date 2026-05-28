'use strict';

// Short-lived (60s), single-use bootstrap nonces for the cross-domain
// admin login flow. The Vercel-hosted admin frontend needs the JWT to
// set a same-domain cookie that Next.js middleware can read; the JWT
// itself used to be returned in the /auth/login response body (visible
// in browser network logs, history, dev tools). Instead we return an
// opaque nonce; the frontend redeems it server-to-server at
// /auth/redeem-bootstrap and only the Vercel route handler ever sees
// the actual JWT.
//
// In-memory storage is fine because:
//  - TTL is 60s, so memory pressure is bounded.
//  - Even with multiple backend instances behind a load balancer, the
//    redemption happens within seconds of issuance — sticky sessions or
//    a quick retry handles the rare cross-instance miss.

const crypto = require('crypto');

const TTL_MS = 60 * 1000;
const store = new Map(); // nonce -> { jwt, expiresAt }

function sweep() {
  const now = Date.now();
  for (const [nonce, entry] of store) {
    if (entry.expiresAt <= now) store.delete(nonce);
  }
}

// Run a sweep every 30s so the map doesn't grow unboundedly if redemption
// fails. unref so it doesn't keep the event loop alive on shutdown.
const sweepInterval = setInterval(sweep, 30 * 1000);
sweepInterval.unref();

function issue(jwtString) {
  const nonce = crypto.randomBytes(32).toString('base64url');
  store.set(nonce, { jwt: jwtString, expiresAt: Date.now() + TTL_MS });
  return nonce;
}

function redeem(nonce) {
  if (!nonce || typeof nonce !== 'string') return null;
  const entry = store.get(nonce);
  if (!entry) return null;
  store.delete(nonce); // single-use
  if (entry.expiresAt <= Date.now()) return null;
  return entry.jwt;
}

module.exports = { issue, redeem };
