'use strict';

// Records durable engineering GOLDEN RULES + PITFALLS into Archivarius, distilled
// from real incidents during the audit & hardening pass:
//   • the Chief's missing Product import (zeroed every weekly brief), and
//   • the "Add product" blank-draft failure (schema-required fields + a silent
//     catch that hid it).
//
// Idempotent — archivarius.remember() dedupes by textKey, so re-running is safe.
// Usage:  node scripts/seedGoldenRules.js
//
// View them afterwards in Admin → Archivarius.

require('dotenv').config();
const mongoose = require('mongoose');
const { remember } = require('../services/archivarius');

const ENTRIES = [
  // ── Pitfalls — the concrete mistakes, so we don't repeat them ──────────────
  { kind: 'pitfall', tags: ['engineering', 'backend', 'mongoose', 'incident'],
    text: 'Empty-draft create paths still run Mongoose schema validators — required fields (name, price) make .save() throw even when app-level validation is skipped. Use save({ validateBeforeSave: false }) and re-validate on publish, or set safe defaults.' },
  { kind: 'pitfall', tags: ['engineering', 'frontend', 'observability', 'incident'],
    text: 'A catch that silently redirects or no-ops on a user action HIDES the bug: the broken Add-product save left no trace and looked like "it just stopped". Always surface and log the error; never swallow a failure on a primary action.' },
  { kind: 'pitfall', tags: ['engineering', 'backend', 'mongoose', 'incident'],
    text: 'Deriving a slug from a placeholder name collides on a unique sparse index across drafts. Leave the unique field unset (empty name) so the sparse index skips it; derive the real value on first edit.' },
  { kind: 'pitfall', tags: ['engineering', 'backend', 'incident'],
    text: 'A service calling Model.method() without importing the model throws ReferenceError only at CALL time — it passes load-time checks, and a fail-soft catch turns it into silent all-zeros (this zeroed every Chief brief). Verify every Model.x usage has a matching require.' },

  // ── Lessons — the golden rules for the future ──────────────────────────────
  { kind: 'lesson', tags: ['engineering', 'golden-rule', 'testing'],
    text: 'GOLDEN RULE: audit the primary WRITE / user journeys first (add product, checkout, edit, create) — not only background services and read paths. The highest-impact bugs hide in the actions users take most.' },
  { kind: 'lesson', tags: ['engineering', 'golden-rule', 'observability'],
    text: 'GOLDEN RULE: fail loud, not silent. Every fallback or catch on a user-facing action must produce a visible error or a logged trace, so failures are observable — never disguised as "nothing happened".' },
  { kind: 'lesson', tags: ['engineering', 'golden-rule', 'data-integrity'],
    text: 'GOLDEN RULE: reasoning safeguards (auditors, clerks, memory) protect against bad reasoning over GOOD data; they cannot catch a broken data gather. Guard the gather itself — verify before asserting empty/zero, and skip rather than emit a confident wrong result.' },
];

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set — run this where the DB env is available (e.g. Railway shell).');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  let added = 0;
  for (const e of ENTRIES) {
    const ok = await remember({
      kind: e.kind, text: e.text, tags: e.tags,
      detail: 'Distilled from a real incident during the audit & hardening pass.',
      source: 'engineering-incident',
    });
    if (ok) added++;
    console.log(`${ok ? '＋ recorded ' : '· already in '} [${e.kind}] ${e.text.slice(0, 64)}…`);
  }
  console.log(`\nArchivarius: ${added} new entr${added === 1 ? 'y' : 'ies'} recorded, ${ENTRIES.length - added} already present.`);
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
