'use strict';

// Propose (and then apply) a consistent product naming scheme.
//
// The catalogue grew three word orders and four capitalisation styles — and
// "Brief" alongside "Briefs" for the same garment. The target is one shape:
//
//     Silk [item] in [Colour]          e.g. "Silk pillowcase in Silver"
//     Silk satin [item] — [Piece name] e.g. "Silk satin scarf — The Grand Tour"
//
// Sentence case for the item, the colour last and capitalised as a shade name,
// no "Silkilinen" prefix (the brand is a separate attribute in the Shopping
// feed, so repeating it burns characters Google actually displays).
//
// The slug is re-cut from the new name in the same pass. That is deliberate:
// changing a URL costs whatever ranking it has accumulated, which today is
// nearly nothing and grows every week. Product.pre('save') records the old slug
// in previousSlugs, /api/products falls back to it, and the storefront
// permanentRedirects to the canonical URL — so old links keep working.
//
// This NEVER renames silently. Run it once to write a plan, read the plan,
// edit anything that reads wrong, then apply it.
//
//   node scripts/renameProducts.js            # write rename-plan.json, change nothing
//   node scripts/renameProducts.js --apply    # apply the plan file as it stands
//
// Anything the script cannot confidently parse is marked "review": true and is
// SKIPPED on apply until you replace its newName by hand. A wrong guess on a
// product name is worse than leaving it alone.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const { slugify } = require('../utils/slug');

const APPLY = process.argv.includes('--apply');
const PLAN_PATH = path.join(__dirname, 'rename-plan.json');

// The convention itself lives in utils/productName.js — the admin form reads
// the same rules, so a name this script would fix is a name the form warns
// about at the moment it is typed.
const { parse } = require('../utils/productName');

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(process.env.MONGODB_URI);

  if (APPLY) {
    if (!fs.existsSync(PLAN_PATH)) {
      console.log('No rename-plan.json found. Run without --apply first, read the plan, then re-run with --apply.');
      await mongoose.disconnect();
      return;
    }
    const plan = JSON.parse(fs.readFileSync(PLAN_PATH, 'utf8'));
    let changed = 0, skipped = 0;
    for (const row of plan) {
      if (row.review) { skipped++; continue; }
      if (!row.newName || row.newName === row.original) { skipped++; continue; }
      const product = await Product.findById(row._id);
      if (!product) { skipped++; continue; }

      product.name = row.newName;
      // Set the slug EXPLICITLY. pre('save') only derives it from the name when
      // the slug is empty, so without this the URL would keep the old wording
      // forever — the exact drift this pass exists to remove.
      product.slug = slugify(row.newName);
      await product.save();
      console.log(`  ${row.original}\n    → ${product.name}\n    → /product/${product.slug}  (was: ${product.previousSlugs.join(', ') || 'unchanged'})`);
      changed++;
    }
    console.log(`\nRenamed ${changed}. Skipped ${skipped} (marked review, unchanged, or missing).`);
    console.log('Old URLs 301 to the new ones via previousSlugs — nothing 404s.');
    await mongoose.disconnect();
    return;
  }

  const products = await Product.find({}).select('_id name slug colorName colours').lean();
  const plan = products.map(p => {
    const parsed = parse(p);
    return {
      _id: String(p._id),
      original: parsed.original,
      newName: parsed.newName || parsed.original,
      newSlug: slugify(parsed.newName || parsed.original),
      oldSlug: p.slug || '',
      review: parsed.review,
    };
  });

  const changing = plan.filter(r => !r.review && r.newName !== r.original);
  const review = plan.filter(r => r.review);
  const same = plan.length - changing.length - review.length;

  console.log(`── PROPOSED (nothing written) ──\n`);
  for (const r of changing) {
    console.log(`  ${r.original}`);
    console.log(`    → ${r.newName}`);
    if (r.newSlug !== r.oldSlug) console.log(`    → /product/${r.newSlug}   (was /product/${r.oldSlug})`);
    console.log('');
  }
  if (review.length) {
    console.log(`── NEEDS A HUMAN (${review.length}) ──`);
    console.log('  Could not confidently split these into garment + colour.');
    console.log('  Edit "newName" in the plan file and set "review": false to include them.\n');
    for (const r of review) console.log(`  ${r.original}`);
    console.log('');
  }

  fs.writeFileSync(PLAN_PATH, JSON.stringify(plan, null, 2));
  console.log(`${changing.length} to rename, ${review.length} need a human, ${same} already correct.`);
  console.log(`\nPlan written to scripts/rename-plan.json.`);
  console.log('Read it, edit anything that reads wrong, then: node scripts/renameProducts.js --apply');
}

main().catch(err => { console.error(err); process.exit(1); });
