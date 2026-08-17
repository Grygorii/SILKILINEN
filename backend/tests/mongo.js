'use strict';

// Shared setup for the tests that need a real MongoDB.
//
// Two suites (auth, productSchema) spin up mongodb-memory-server, which
// DOWNLOADS a mongod binary on first use. Where that download is blocked — this
// sandbox answers 403 for fastdl.mongodb.org — MongoMemoryServer.create() threw
// inside beforeAll, so both suites reported as FAILED and `npm test` exited
// non-zero. A suite that fails for a reason unrelated to the code is worse than
// one that does not run: it makes red the normal state, and a real failure then
// looks like the usual noise.
//
// So: an unavailable binary is a SKIP with a printed reason, never a pass and
// never a failure. The tests themselves are unchanged and still run wherever a
// Mongo is actually reachable.
//
// MONGODB_TEST_URI short-circuits the download entirely — point it at a real
// server (a CI service container, or a local mongod) and these suites run
// without needing the binary at all.

const { MongoMemoryServer } = require('mongodb-memory-server');

// Pinned: mongodb-memory-server's auto-selected version sometimes picks a build
// that does not exist for the current platform (ubuntu2404 + mongo 8.2.x).
const BINARY_VERSION = '7.0.14';

/**
 * @returns {Promise<{uri: string, stop: () => Promise<void>}|null>} null when no
 *   MongoDB can be obtained, in which case the caller must SKIP rather than fail.
 */
async function tryStartMongo() {
  if (process.env.MONGODB_TEST_URI) {
    return { uri: process.env.MONGODB_TEST_URI, stop: async () => {} };
  }
  try {
    const mongod = await MongoMemoryServer.create({ binary: { version: BINARY_VERSION } });
    return { uri: mongod.getUri(), stop: () => mongod.stop() };
  } catch (err) {
    // Loud, once per suite. Silence here would turn "we never checked the schema
    // constraints" into something indistinguishable from "they pass" — the
    // summary line only says "14 skipped", which nobody reads as a warning.
    //
    // Written straight to stderr rather than via console.warn: vitest
    // intercepts console output and does not surface it for skipped files in a
    // multi-file run, so console.warn here printed only when the file was run on
    // its own — i.e. never, in the run that matters.
    process.stderr.write(
      `\n[tests] SKIPPED the MongoDB-backed suite: could not obtain a mongod binary.\n` +
      `        Reason: ${err.message.split('\n')[0]}\n` +
      '        These tests did NOT run — they are not passing. Set MONGODB_TEST_URI to a\n' +
      '        reachable MongoDB to run them where the download is blocked.\n\n'
    );
    return null;
  }
}

module.exports = { tryStartMongo, BINARY_VERSION };
