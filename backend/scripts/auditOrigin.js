/**
 * Founder origin map — READ ONLY. Lists every product and its current
 * `origin` value, flagging any that must be verified before it can be shown
 * as a manufacturing claim.
 *
 * Why this exists: a previous migration set EVERY product to
 * "Made in Donegal", but origin is actually mixed (some Donegal-made, some
 * imported from China / India / Egypt). We must never assert an origin we
 * haven't verified, and we must never GUESS one. This script produces the
 * list the founders fill in; nothing here writes to the database.
 *
 * A product NEEDS VERIFICATION when its origin is empty OR still matches a
 * blanket Donegal/Ireland/handmade phrase (i.e. it was set by the old
 * default, not confirmed per-product).
 *
 *   node backend/scripts/auditOrigin.js
 *
 * Output: a table the founders annotate with the TRUE origin per product,
 * which is then entered in the admin product editor (Material & care →
 * leave blank if unverified). See ADR 0008 in decisions.md.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Product = require('../models/Product');

// Values that are NOT a verified per-product origin: empty, or a legacy
// blanket claim that the old default/copy injected.
const SUSPECT = /^\s*$|donegal|ireland|irish|handmade|made by hand|hand-?(made|finished|sewn)/i;

async function run() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
  await mongoose.connect(process.env.MONGODB_URI);

  const products = await Product.find({})
    .select('name slug origin status variants')
    .sort({ name: 1 })
    .lean();

  const needs = [];
  const verified = [];
  for (const p of products) {
    const sku = p.variants?.[0]?.sku || '';
    const row = { name: p.name, sku, status: p.status, origin: p.origin || '(empty)' };
    if (SUSPECT.test(p.origin || '')) needs.push(row);
    else verified.push(row);
  }

  console.log(`\n=== ORIGIN AUDIT — ${products.length} products ===\n`);
  console.log(`NEEDS FOUNDER VERIFICATION: ${needs.length}`);
  console.log(`Already has a specific, non-blanket origin: ${verified.length}\n`);

  console.log('--- TO VERIFY (fill the TRUE origin, then set it in admin) ---');
  console.log('product name'.padEnd(48), 'sku'.padEnd(16), 'current origin');
  for (const r of needs) {
    console.log(String(r.name).padEnd(48), String(r.sku).padEnd(16), r.origin);
  }

  if (verified.length) {
    console.log('\n--- already specific (double-check these are correct) ---');
    for (const r of verified) {
      console.log(String(r.name).padEnd(48), String(r.sku).padEnd(16), r.origin);
    }
  }

  console.log('\nReminder: a wrong origin is worse than a blank. Leave unverified products blank.');
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
