'use strict';

// Tiny helper to record one-shot migration runs in a `migrations`
// collection so re-running the same script is a no-op. Independent of
// the per-script idempotency tricks each script already does (those
// stay — this is belt-and-braces).
//
//   const { hasRun, markRun } = require('./_lib/migrations');
//   if (await hasRun(MIGRATION_NAME)) { ... return }
//   ...do work...
//   await markRun(MIGRATION_NAME);

const mongoose = require('mongoose');

const COLLECTION = 'migrations';

async function hasRun(name) {
  const doc = await mongoose.connection.collection(COLLECTION).findOne({ name });
  return !!doc;
}

async function markRun(name, meta) {
  await mongoose.connection.collection(COLLECTION).insertOne({
    name,
    runAt: new Date(),
    meta: meta || {},
  });
}

module.exports = { hasRun, markRun };
