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

module.exports = { emailBlastLimit, aiLimit };
