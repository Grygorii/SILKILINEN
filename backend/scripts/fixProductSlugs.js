'use strict';

// Re-cut product slugs that no longer describe the product.
//
// The slug is derived from the name ONLY while it is empty — Product.pre('save')
// does `if (!this.slug && this.name)`, and the admin form's auto-fill has the
// same guard. So the first name a product is given owns its URL for ever, and
// every rename afterwards moves the name away from it in silence.
//
// That is not cosmetic. Two nightshirt URLs both said "copper" and neither
// product was copper:
//
//   /product/silk-nightshirt-in-copper    → Silk nightshirt in Bare Champagne
//   /product/silk-nightshirt-in-copper-2  → Silk nightshirt in Wine Red
//
// A shopper clicking a link that says copper landed on a wine red nightshirt,
// and Google reported the pair as duplicates without a canonical it could pick.
//
// renameProducts.js does NOT cover this: it re-cuts the slug only for products
// it RENAMES, so a product whose name is already correct keeps its stale URL.
// This script is the other half.
//
//   node scripts/fixProductSlugs.js            # write slug-plan.json, change nothing
//   node scripts/fixProductSlugs.js --apply    # apply the plan file as it stands
//
// ⚠️ The Railway shell is EPHEMERAL — each session is a fresh container, so the
// plan file does not survive between sessions. Write the plan and apply it in
// the SAME shell, or --apply finds no plan and silently does nothing.
//
// Note: this does NOT ping IndexNow. Every other path that changes a product
// URL does (adminProducts, adminCollections, adminCategories), but a script
// exits the moment it disconnects, so a fire-and-forget HTTP call would be
// killed mid-flight. After applying, click **Submit to IndexNow** on
// /admin/seo — it resubmits the whole public surface, new URLs included.
//
// ⚠️ Run renameProducts.js --apply FIRST if it has anything pending. Fixing a
// slug and then renaming the product costs two redirect hops for one product.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const { slugify } = require('../utils/slug');

const APPLY = process.argv.includes('--apply');
const PLAN_PATH = path.join(__dirname, 'slug-plan.json');

/**
 * Pure planner: which products need a new slug, and which can't have one.
 *
 * A conflict is judged against the FINAL state, not the live one — if A wants
 * the slug B currently holds, but B is moving away in this same pass, that is
 * not a collision. Judging against live slugs would refuse the exact case this
 * script exists for, since the drifted names cluster on one garment.
 *
 * A real conflict is never resolved by guessing. pre('save') would append -2,
 * which is precisely how `silk-nightshirt-in-copper-2` came to exist.
 */
function planSlugFixes(products) {
  const want = new Map();
  for (const p of products) want.set(String(p._id), slugify(p.name || ''));

  // Where every product ENDS UP: its target if it has a usable name, else the
  // slug it keeps.
  const settled = new Map();
  for (const p of products) {
    const id = String(p._id);
    settled.set(id, want.get(id) || p.slug || '');
  }

  const rows = [];
  for (const p of products) {
    const id = String(p._id);
    const target = want.get(id);
    if (!target) { rows.push({ _id: id, name: p.name || '', oldSlug: p.slug || '', review: 'product has no usable name' }); continue; }
    if (p.slug === target) continue;

    const clash = products.find(o => String(o._id) !== id && settled.get(String(o._id)) === target);
    rows.push({
      _id: id,
      name: p.name || '',
      oldSlug: p.slug || '',
      newSlug: target,
      ...(clash ? { review: `"${clash.name}" also resolves to this slug — rename one of them first` } : {}),
    });
  }
  return rows;
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(process.env.MONGODB_URI);

  if (APPLY) {
    if (!fs.existsSync(PLAN_PATH)) {
      // Exit NON-ZERO. This message has scrolled past inside a pasted block of
      // commands three times now, each time reading as success while the apply
      // did nothing at all. A failing exit code stops a chained run and shows
      // up in the shell even when the text does not.
      console.error('No slug-plan.json found. Run without --apply first, read the plan, then re-run with --apply.');
      await mongoose.disconnect();
      process.exitCode = 1;
      return;
    }
    const plan = JSON.parse(fs.readFileSync(PLAN_PATH, 'utf8'));
    let changed = 0, skipped = 0;
    for (const row of plan) {
      if (row.review || !row.newSlug) { skipped++; continue; }
      const product = await Product.findById(row._id);
      if (!product) { skipped++; continue; }
      // Re-check against the live record: the founder may have fixed one by
      // hand between the plan and the apply.
      if (product.slug === row.newSlug) { skipped++; continue; }

      product.slug = row.newSlug;
      await product.save();

      // pre('save') appends -2 rather than failing when a slug is taken. That
      // is how the mess this script cleans up was made, so say so loudly rather
      // than reporting a success that isn't one.
      if (product.slug !== row.newSlug) {
        console.log(`  ! ${row.name}\n      asked for /product/${row.newSlug}, got /product/${product.slug} — slug was taken`);
        skipped++;
        continue;
      }
      console.log(`  ${row.name}\n    → /product/${product.slug}   (was /product/${row.oldSlug})`);
      changed++;
    }
    console.log(`\nRe-cut ${changed}. Skipped ${skipped} (marked review, already correct, or missing).`);
    console.log('Old URLs 301 to the new ones via previousSlugs — nothing 404s.');
    await mongoose.disconnect();
    return;
  }

  const products = await Product.find({}).select('_id name slug').sort('name').lean();
  const rows = planSlugFixes(products);
  const changing = rows.filter(r => !r.review);
  const review = rows.filter(r => r.review);

  console.log('── PROPOSED (nothing written) ──\n');
  for (const r of changing) {
    console.log(`  ${r.name}`);
    console.log(`    /product/${r.oldSlug || '(none)'}  →  /product/${r.newSlug}\n`);
  }
  if (review.length) {
    console.log(`── NEEDS A HUMAN (${review.length}) ──\n`);
    for (const r of review) console.log(`  ${r.name}\n    ${r.review}\n`);
  }

  fs.writeFileSync(PLAN_PATH, JSON.stringify(rows, null, 2));
  console.log(`${changing.length} to re-cut, ${review.length} need a human, ${products.length - rows.length} already correct.`);
  console.log('\nPlan written to scripts/slug-plan.json.');
  console.log('Read it, delete any row you want left alone, then: node scripts/fixProductSlugs.js --apply');
}

module.exports = { planSlugFixes };

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}
