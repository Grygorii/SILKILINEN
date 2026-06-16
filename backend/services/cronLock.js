'use strict';

// Distributed cron lock so a scheduled job runs on only ONE web instance per
// window, even when Railway scales to several. The crons live as setInterval
// timers inside the web process; without this, every instance would run every
// cron — doubling AI spend (growth engine) and racing the lastRun guards.
//
// Mechanism: an atomic, conditional upsert on a SystemState doc whose `key` is
// uniquely indexed. We claim only when no lock exists or the existing one has
// expired; if a valid lock is held elsewhere, the upsert's insert attempt hits
// the unique index (E11000) and we simply skip this run. The lock auto-expires
// after ttlMs, so a crashed holder can never block a job forever. We do NOT
// release early: the TTL (minutes) is shorter than every job's interval (≥1h)
// but long enough to cover a run, and the jobs' own cadence guards / idempotency
// handle the next window.

const crypto = require('crypto');
const SystemState = require('../models/SystemState');

// Unique per process so a returned doc can be confirmed as ours.
const PROC_ID = `${process.pid}-${crypto.randomBytes(4).toString('hex')}`;

// Run fn() only if this instance wins the named lock. Returns fn()'s result, or
// undefined if the lock was held elsewhere (run skipped).
async function withCronLock(name, ttlMs, fn) {
  const key = `cronLock:${name}`;
  const now = Date.now();
  const until = now + ttlMs;
  let acquired = false;
  try {
    const res = await SystemState.findOneAndUpdate(
      // Match only when there's no live lock: doc absent, or its expiry passed.
      { key, $or: [{ 'value.until': { $lte: now } }, { 'value.until': { $exists: false } }] },
      { $set: { key, value: { until, holder: PROC_ID } } },
      { upsert: true, new: true }
    );
    acquired = Boolean(res && res.value && res.value.holder === PROC_ID && res.value.until === until);
  } catch (err) {
    // E11000: a valid lock exists and our upsert raced to insert — not ours.
    if (err.code !== 11000) console.error(`[cronLock:${name}]`, err.message);
    return undefined;
  }
  if (!acquired) return undefined;
  return fn();
}

module.exports = { withCronLock };
