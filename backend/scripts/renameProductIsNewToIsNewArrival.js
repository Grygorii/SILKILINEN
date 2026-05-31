#!/usr/bin/env node
/**
 * Rename Product.isNew → Product.isNewArrival on every product where
 * isNew was set. Necessary because Mongoose reserves the `isNew`
 * pathname (it's the internal "not yet persisted" flag on every
 * document), so a schema field with that name broke save() — the doc
 * thinks it's a fresh insert and hits a duplicate-key error on _id.
 *
 *   node scripts/renameProductIsNewToIsNewArrival.js          # report only
 *   node scripts/renameProductIsNewToIsNewArrival.js --apply  # actually rename
 *
 * Idempotent. Safe to re-run.
 */

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);

  // Use the raw collection so the new schema (which no longer declares
  // isNew) doesn't filter the field out.
  const col = mongoose.connection.collection('products');

  // Anything with a stored isNew value needs to be migrated. Note:
  // because Mongoose's reserved `isNew` flag was shadowing this field,
  // existing values may be unreliable — they reflect whatever the schema
  // path happened to be set to at the moment of the bad save. Trust them
  // anyway; if any are wrong, an admin can flip them in the UI.
  const candidates = await col.find(
    { isNew: { $exists: true } },
    { projection: { _id: 1, name: 1, status: 1, isNew: 1, isNewArrival: 1 } },
  ).toArray();

  console.log(`found ${candidates.length} product(s) with the legacy isNew field`);
  for (const p of candidates) {
    console.log(`  _id=${p._id}  status=${p.status}  isNew=${p.isNew}  isNewArrival=${p.isNewArrival ?? '(unset)'}  name=${JSON.stringify(p.name)}`);
  }

  if (!APPLY) {
    console.log('\nre-run with --apply to copy values to isNewArrival and unset isNew');
    await mongoose.disconnect();
    return;
  }

  let copied = 0;
  let unsetOnly = 0;
  for (const p of candidates) {
    const update = { $unset: { isNew: '' } };
    // Only set isNewArrival if it isn't already explicitly set, so we
    // don't clobber an admin edit made after the rename deployed.
    if (typeof p.isNewArrival !== 'boolean' && typeof p.isNew === 'boolean') {
      update.$set = { isNewArrival: p.isNew };
      copied++;
    } else {
      unsetOnly++;
    }
    await col.updateOne({ _id: p._id }, update);
  }
  console.log(`\ndone — copied isNew → isNewArrival on ${copied} doc(s); unset stale isNew on ${unsetOnly} doc(s)`);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
