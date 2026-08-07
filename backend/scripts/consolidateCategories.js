'use strict';

// Rename + consolidate the storefront categories.
//
// Nine near-overlapping categories read as a directory, not a curated edit —
// and "Home Essential" / "Sleep Essential" are singular and hard to tell apart.
// This merges the thin ones into clear parents and renames the rest.
//
// SAFE BY DEFAULT: prints a plan and changes nothing. Add --apply to write.
//   node scripts/consolidateCategories.js            # dry run (recommended first)
//   node scripts/consolidateCategories.js --apply
//
// What it does, in order:
//   1. MERGE — reassign every product from a source slug to its target slug,
//      then archive the now-empty source category.
//   2. RENAME — update the label only (the slug/URL is untouched, so no
//      redirects are needed and nothing that Google has indexed breaks).
//
// It is self-discovering: anything in the maps that doesn't exist in this
// database is skipped and reported, so it's safe to re-run.

require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');

const APPLY = process.argv.includes('--apply');

// source slug -> target slug. Products move; the source is archived.
const MERGE = {
  'shorts': 'lounge',
  'shirts': 'lounge',
  'eye-masks': 'home',       // sleep accessories live with the home pieces
  'pillowcases': 'home',
  'pyjamas': 'sleepwear',
  'sleep-dresses': 'sleepwear',
};

// slug -> new label. Display only; URLs unchanged.
const RENAME = {
  robes: 'Robes',
  sleepwear: 'Sleepwear',
  lingerie: 'Lingerie',
  lounge: 'Loungewear',
  home: 'Home & Sleep',
  scarves: 'Scarves',
};

// Targets that must exist for a merge to land.
const ENSURE = [
  { slug: 'sleepwear', label: 'Sleepwear' },
  { slug: 'lounge', label: 'Loungewear' },
  { slug: 'home', label: 'Home & Sleep' },
];

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set — run this where the DB env is available (e.g. the Railway shell).');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(APPLY ? '⚠  APPLYING CHANGES\n' : 'DRY RUN — nothing will be written. Re-run with --apply to commit.\n');

  // ── Current state ──────────────────────────────────────────────────────────
  const cats = await Category.find({}).sort({ displayOrder: 1, createdAt: 1 }).lean();
  const counts = await Product.aggregate([
    { $match: { status: { $in: ['active', 'sold_out'] } } },
    { $group: { _id: '$category', n: { $sum: 1 } } },
  ]);
  const countBy = Object.fromEntries(counts.map(c => [c._id, c.n]));
  console.log('CURRENT CATEGORIES');
  for (const c of cats) console.log(`  ${String(c.slug).padEnd(16)} ${String(c.label).padEnd(22)} ${countBy[c.slug] || 0} product(s)  [${c.status}]`);
  console.log('');

  // ── 1. Ensure merge targets exist ──────────────────────────────────────────
  for (const t of ENSURE) {
    const exists = cats.find(c => c.slug === t.slug);
    if (exists) continue;
    console.log(`+ create category "${t.label}" (${t.slug})`);
    if (APPLY) {
      await Category.create({ slug: t.slug, label: t.label, status: 'active', displayOrder: 50 });
    }
  }

  // ── 2. Merge ───────────────────────────────────────────────────────────────
  console.log('\nMERGES');
  for (const [from, to] of Object.entries(MERGE)) {
    const n = await Product.countDocuments({ category: from });
    if (!n) { console.log(`  · ${from} → ${to}: nothing to move`); }
    else {
      console.log(`  → ${from} → ${to}: move ${n} product(s)`);
      if (APPLY) await Product.updateMany({ category: from }, { $set: { category: to } });
    }
    const src = await Category.findOne({ slug: from });
    if (src && src.status !== 'archived') {
      console.log(`    archive category "${src.label}" (${from})`);
      if (APPLY) { src.status = 'archived'; await src.save(); }
    }
  }

  // ── 3. Rename ──────────────────────────────────────────────────────────────
  console.log('\nRENAMES (label only — URLs unchanged)');
  for (const [slug, label] of Object.entries(RENAME)) {
    const c = await Category.findOne({ slug });
    if (!c) { console.log(`  · ${slug}: not in this database, skipped`); continue; }
    if (c.label === label) { console.log(`  · ${slug}: already "${label}"`); continue; }
    console.log(`  → ${slug}: "${c.label}" → "${label}"`);
    if (APPLY) { c.label = label; await c.save(); }
  }

  // ── 4. Homepage order ──────────────────────────────────────────────────────
  // The homepage shows the first THREE active categories by displayOrder.
  const HOME_THREE = ['lingerie', 'robes', 'sleepwear'];
  console.log('\nHOMEPAGE ORDER (first three appear on the homepage)');
  for (let i = 0; i < HOME_THREE.length; i++) {
    const c = await Category.findOne({ slug: HOME_THREE[i] });
    if (!c) { console.log(`  · ${HOME_THREE[i]}: not found, skipped`); continue; }
    console.log(`  ${i + 1}. ${c.label} (${c.slug})`);
    if (APPLY) { c.displayOrder = i; c.status = 'active'; await c.save(); }
  }
  // Push everything else after them.
  if (APPLY) {
    const rest = await Category.find({ slug: { $nin: HOME_THREE }, status: 'active' });
    let i = HOME_THREE.length;
    for (const c of rest) { c.displayOrder = i++; await c.save(); }
  }

  if (!APPLY) console.log('\nDRY RUN complete — no changes written. Re-run with --apply when the plan looks right.');
  else console.log('\nDone. Check Admin → Categories, then the homepage.');
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
