'use strict';

// Persistent, restart/deploy-surviving daily cost cap for AI calls.
//
// Generalises the per-day counter aiPhotos.js already uses for Gemini image
// generation. The DeepSeek-backed admin tools previously relied only on
// in-memory express-rate-limit counters, which reset on every Railway restart /
// deploy — so a compromised admin session (or a stuck retry loop) had no
// cumulative daily ceiling on API spend. This uses the same SystemState-backed
// atomic $inc with a compensating rollback so the ceiling holds across restarts.

const SystemState = require('../models/SystemState');

async function enforceDailyCap(bucket, { envVar, fallback } = {}) {
  const limit = parseInt(process.env[envVar] || String(fallback), 10);
  // Misconfigured / non-positive limit → don't block real work; the in-memory
  // per-hour limiters still apply on the routes.
  if (!Number.isFinite(limit) || limit <= 0) return;

  const today = new Date().toISOString().slice(0, 10); // server clock (TZ set by platform)
  const key = `ai_daily_${bucket}_${today}`;

  const state = await SystemState.findOneAndUpdate(
    { key },
    { $inc: { value: 1 } },
    { upsert: true, new: true }
  );

  if (state.value > limit) {
    // Over the ceiling — undo our increment so the counter reflects reality.
    await SystemState.findOneAndUpdate({ key }, { $inc: { value: -1 } });
    const err = new Error(`Daily AI limit (${limit}) reached for ${bucket}. Try again tomorrow.`);
    err.code = 'AI_DAILY_LIMIT';
    throw err;
  }
}

module.exports = { enforceDailyCap };
