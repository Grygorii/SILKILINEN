'use strict';

const rateLimit = require('express-rate-limit');

const isDev = process.env.NODE_ENV !== 'production';

// NOTE: these limiters intentionally count EVERY request, including failures.
// On auth/write endpoints the whole point is to bound the number of attempts an
// attacker can make, and most of those attempts fail validation (wrong code,
// invalid token). An earlier `skipFailedRequests` + `statusCode < 500` config
// excluded 4xx/5xx from the budget, which silently un-throttled exactly the
// brute-force / forced-error traffic these limiters exist to stop.

// 5 requests per 10 minutes — magic link, Google OAuth
const authRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { error: 'Too many attempts. Please try again in 10 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
});

// 10 requests per hour — newsletter subscribe, contact form
const publicWriteRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many requests. Please try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
});

// 30 requests per hour — drop-a-hint and similar light writes
const lightRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
});

// 120 requests per 5 minutes per IP — the storefront cart. Generous enough for
// a real shopper (add/remove/quantity/country/discount all hit this router,
// plus a load-time GET) but bounds scripted promo-code brute-force and
// unbounded Cart-document creation via GET /:sessionId.
const cartRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 120,
  message: { error: 'Too many cart requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
});

module.exports = { authRateLimit, publicWriteRateLimit, lightRateLimit, cartRateLimit };
