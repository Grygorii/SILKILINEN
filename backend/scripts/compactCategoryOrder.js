'use strict';

// Give every category a distinct displayOrder.
//
// The admin list shows twelve categories with four colliding pairs:
//
//   1 → Robes, Pyjama Sets        2 → Sleep Dresses, Sleepwear
//   4 → Lounge Shorts, Scarves    5 → Lounge Shirts, Loungewear
//
// The storefront sorts by { displayOrder, createdAt }, so the ORDER shown is
// at least stable — this is not a live rendering bug. What it does break is the
// admin: the ORDER column stops describing the sequence you actually see, so
// editing it produces results that look arbitrary. Archive or restore a
// category and its twin silently swaps position.
//
// Active categories are renumbered 0..n in their current visible order — the
// same sort the storefront uses — so nothing moves on the site. Archived ones
// are pushed above the active range so they never collide with a live category
// if they are restored later.
//
//   node scripts/compactCategoryOrder.js           # show the plan
//   node scripts/compactCategoryOrder.js --apply

require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../models/Category');

const APPLY = process.argv.includes('--apply');

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(process.env.MONGODB_URI);

  // Exactly the storefront's ordering, so renumbering preserves what visitors
  // currently see rather than imposing a new sequence.
  const sort = { displayOrder: 1, createdAt: 1 };
  const active = await Category.find({ status: 'active' }).sort(sort).lean();
  const archived = await Category.find({ status: { $ne: 'active' } }).sort(sort).lean();

  console.log(APPLY ? '── APPLYING ──\n' : '── PROPOSED (nothing written) ──\n');
  console.log('ACTIVE (renumbered 0..n, order preserved):');
  active.forEach((c, i) => {
    const change = c.displayOrder === i ? '' : `   ${c.displayOrder} → ${i}`;
    console.log(`  ${String(i).padStart(2)}  ${c.label}${change}`);
  });

  console.log('\nARCHIVED (moved above the active range so a restore cannot collide):');
  archived.forEach((c, i) => {
    const to = 100 + i;
    console.log(`  ${String(to).padStart(3)}  ${c.label}   ${c.displayOrder} → ${to}`);
  });

  if (!APPLY) {
    console.log('\nDry run — nothing written. Re-run with --apply.');
    await mongoose.disconnect();
    return;
  }

  // updateOne, not save(): Category.pre('save') normalises the slug, and
  // re-slugging a category orphans every product whose `category` string points
  // at the old value. Renumbering must never touch slugs.
  let n = 0;
  for (const [i, c] of active.entries()) {
    await Category.updateOne({ _id: c._id }, { $set: { displayOrder: i } });
    n++;
  }
  for (const [i, c] of archived.entries()) {
    await Category.updateOne({ _id: c._id }, { $set: { displayOrder: 100 + i } });
    n++;
  }

  console.log(`\nRenumbered ${n} categories. Storefront order is unchanged.`);
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
