'use strict';

// Move the products currently in the legacy "home" category into the real
// "Home Essential" category, so they're reachable from the nav (the Site Audit
// flagged 3 active "home" products with no category page).
//
// Self-discovering + idempotent: it finds the Home Essential category live (by
// label/slug) so no slug is hardcoded, reassigns any "home" products to it, and
// makes sure the category is active. Safe to re-run — a second run finds nothing
// left to move.
//
// Usage (where the DB env is available, e.g. Railway shell):
//   node scripts/reassignHomeToHomeEssential.js

require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');

const SOURCE_SLUGS = ['home']; // legacy product-category string(s) to move

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set — run this where the DB env is available (e.g. Railway shell).');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);

  // 1. Find the Home Essential category — the live source of truth, not a guess.
  const target = await Category.findOne({
    $or: [
      { label: { $regex: /home\s*essential/i } },
      { slug: { $in: ['home-essential', 'home-essentials', 'home'] } },
    ],
  }).lean();

  if (!target) {
    const all = await Category.find().select('slug label status').lean();
    console.error('Could not find a "Home Essential" category. Existing categories:');
    all.forEach(c => console.error(`  - ${c.slug}  (${c.label})  [${c.status}]`));
    console.error('\nTell me the exact slug to use and I\'ll point the script at it.');
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`Target category: "${target.label}"  slug=${target.slug}  status=${target.status}`);

  // 2. The products to move.
  const toMove = await Product.find({ category: { $in: SOURCE_SLUGS } }).select('name category status').lean();
  console.log(`\nFound ${toMove.length} product(s) in [${SOURCE_SLUGS.join(', ')}]:`);
  toMove.forEach(p => console.log(`  - ${p.name}  (${p.status})`));

  if (target.slug === 'home') {
    console.log('\nHome Essential already uses slug "home" — these products are already in it. Nothing to do.');
    await mongoose.disconnect();
    return;
  }
  if (toMove.length === 0) {
    console.log('\nNothing left to move — already reassigned.');
    await mongoose.disconnect();
    return;
  }

  // 3. Reassign (category is a plain string field; updateMany is safe and skips
  //    unrelated legacy validators).
  const res = await Product.updateMany(
    { category: { $in: SOURCE_SLUGS } },
    { $set: { category: target.slug } },
  );
  console.log(`\nReassigned ${res.modifiedCount} product(s) to "${target.slug}".`);

  // 4. Make sure the category is active so it shows in the nav.
  if (target.status !== 'active') {
    await Category.updateOne({ _id: target._id }, { $set: { status: 'active' } });
    console.log(`Activated "${target.slug}" so it appears in navigation.`);
  }

  await mongoose.disconnect();
  console.log('\nDone. Re-run the Site Audit to confirm the "home" finding is gone.');
}

main().catch(err => { console.error(err); process.exit(1); });
