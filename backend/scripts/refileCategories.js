'use strict';

// Move products that are filed under the wrong category.
//
// The advisor now NAMES these (utils/categoryFit.js decides), but naming them
// left the founder opening each product by hand. This is the hands for that
// finding — the same shape as scripts/renameProducts.js, because the risk is the
// same: a category is repeated in the breadcrumb, the /shop filter and the
// Shopping feed's product_type, so a wrong move is wrong in three
// customer-facing places at once.
//
// It NEVER moves anything silently. Run it once to write a plan, read the plan,
// edit or delete any row that reads wrong, then apply it.
//
//   node scripts/refileCategories.js            # write refile-plan.json, change nothing
//   node scripts/refileCategories.js --apply    # apply the plan file as it stands
//
// Why a plan file rather than a one-shot fix: the rule is conservative but not
// omniscient. It only knows garment words someone taught it, and the founder may
// have filed something deliberately — a slip dress in Lingerie because it sells
// there. A plan you can edit keeps that judgement with the person who has it.
//
// The product's SLUG IS NOT TOUCHED. Category is not part of the product URL
// (/product/<slug>), so refiling costs no ranking and needs no redirect — unlike
// renameProducts.js, which re-cuts the slug on purpose.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');
const { misfiledCategory } = require('../utils/categoryFit');

const APPLY = process.argv.includes('--apply');
const PLAN_PATH = path.join(__dirname, 'refile-plan.json');

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set — run this where the DB env is available (e.g. the Railway shell).');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);

  if (APPLY) {
    if (!fs.existsSync(PLAN_PATH)) {
      console.log('No refile-plan.json found. Run without --apply first, read the plan, then re-run with --apply.');
      await mongoose.disconnect();
      return;
    }
    // Re-read the live categories on apply. The plan may have been written days
    // ago and a category can be archived in between — moving a product into one
    // that is no longer live would hide it from the shop entirely.
    const live = new Set((await Category.find({ status: 'active' }).select('slug').lean()).map(c => c.slug));

    const plan = JSON.parse(fs.readFileSync(PLAN_PATH, 'utf8'));
    let moved = 0, skipped = 0;
    for (const row of plan) {
      if (!row.to || row.to === row.from) { skipped++; continue; }
      if (!live.has(row.to)) {
        console.log(`  [skip] "${row.name}" → ${row.to} (that category is not active any more)`);
        skipped++;
        continue;
      }
      const product = await Product.findById(row._id);
      if (!product) { skipped++; continue; }
      // Guard against a stale plan: if someone already refiled this product by
      // hand, leave their choice alone rather than overwriting it.
      if (product.category !== row.from) {
        console.log(`  [skip] "${row.name}" is now in ${product.category}, not ${row.from} — already handled`);
        skipped++;
        continue;
      }
      product.category = row.to;
      await product.save();
      console.log(`  ${row.name}\n    ${row.from} → ${row.to}`);
      moved++;
    }
    console.log(`\nMoved ${moved}. Skipped ${skipped}.`);
    if (moved) console.log('The breadcrumb and shop filter change immediately; the Shopping feed follows on the next crawl.');
    await mongoose.disconnect();
    return;
  }

  const categories = await Category.find().select('slug label status').lean();
  const liveSlugs = categories.filter(c => c.status === 'active').map(c => c.slug);
  const labelOf = slug => categories.find(c => c.slug === slug)?.label || slug;

  // Every product, not only the active ones — a draft filed wrong becomes a
  // live mistake the day it is published.
  const products = await Product.find({}).select('_id name category status').lean();

  const plan = [];
  for (const p of products) {
    const verdict = misfiledCategory(p.name, p.category, liveSlugs);
    if (!verdict) continue;
    plan.push({
      _id: String(p._id),
      name: p.name,
      status: p.status,
      from: p.category,
      to: verdict.expected[0],
      // Recorded so a human reading the plan can see WHY, and can tell a
      // confident single answer from a garment that fits two categories.
      garment: verdict.garment,
      alternatives: verdict.expected.slice(1),
    });
  }

  if (!plan.length) {
    console.log(`Nothing to refile — checked ${products.length} products against ${liveSlugs.length} live categories.`);
    await mongoose.disconnect();
    return;
  }

  console.log('── PROPOSED (nothing written) ──\n');
  for (const r of plan) {
    console.log(`  ${r.name}${r.status !== 'active' ? `  [${r.status}]` : ''}`);
    console.log(`    ${labelOf(r.from)} → ${labelOf(r.to)}   (matched on "${r.garment}")`);
    if (r.alternatives.length) {
      console.log(`    also defensible: ${r.alternatives.map(labelOf).join(', ')} — edit "to" in the plan if you prefer one`);
    }
    console.log('');
  }

  fs.writeFileSync(PLAN_PATH, JSON.stringify(plan, null, 2));
  console.log(`${plan.length} to refile, out of ${products.length} products.`);
  console.log('\nPlan written to scripts/refile-plan.json.');
  console.log('Read it, delete any row you disagree with, then: node scripts/refileCategories.js --apply');
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
