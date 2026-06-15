'use strict';

// Strip MongoDB operator keys ($-prefixed) and dotted keys from request bodies.
// Without this, a JSON payload like {"token":{"$gt":""}} reaches Mongoose as a
// query operator object — the root cause of the NoSQL operator-injection class
// (e.g. the magic-link account-takeover vector). Legitimate request bodies in
// this app never use $-prefixed or dotted keys (writes go through field
// allowlists), so removing them is safe.
//
// Express 5 makes req.query a read-only getter, so we sanitise req.body here and
// coerce query values to strings at the few endpoints that filter on them.

function scrub(value, depth = 0) {
  if (depth > 8 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    for (const v of value) scrub(v, depth + 1);
    return value;
  }
  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete value[key];
    } else {
      scrub(value[key], depth + 1);
    }
  }
  return value;
}

function sanitizeBody(req, _res, next) {
  if (req.body && typeof req.body === 'object') scrub(req.body);
  next();
}

module.exports = { sanitizeBody, scrub };
