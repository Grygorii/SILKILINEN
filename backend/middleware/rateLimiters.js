'use strict';

// Shared rate limiters for expensive admin actions. These endpoints are behind
// requireAuth, but several fan out to hundreds of emails or repeated AI calls —
// so a stuck loop, a double-click, or a compromised admin cookie could burn the
// email quota or run up AI spend. A per-hour cap bounds the blast radius.

const rateLimit = require('express-rate-limit');

const base = { windowMs: 60 * 60 * 1000, standardHeaders: true, legacyHeaders: false };

// Bulk email blasts (win-back, review requests) — a handful per hour is plenty.
const emailBlastLimit = rateLimit({
  ...base,
  max: 6,
  message: { error: 'Too many bulk-email sends in the last hour. Wait a few minutes and try again.' },
});

// AI-heavy admin actions (site audit, analysis regenerate, advisor test) — bound spend.
const aiLimit = rateLimit({
  ...base,
  max: 20,
  message: { error: 'Too many AI generation calls in the last hour. Wait a few minutes and try again.' },
});

// Global floor for the whole API. Every public route — products, collections,
// content, journal, shipping, rates, track — had NO limiter at all: only
// checkout, the AI endpoints and email blasts were protected. A single client
// could hammer /api/products or /api/track and drive Mongo load and Railway
// spend with nothing to stop it.
//
// Deliberately generous. This is a floor against abuse, not a traffic policy:
// a real shopper browsing quickly, with a page firing several parallel product
// and content requests, must never see a 429. The tighter per-route limits
// (checkout: 20/5min, ai: 20/hr) still apply on top.
const globalLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  // Health checks are what tells us the box is alive; never throttle them.
  skip: req => req.path === '/api/health' || req.path === '/health',
  message: { error: 'Too many requests. Please slow down.' },
});

module.exports = { emailBlastLimit, aiLimit, globalLimit };
