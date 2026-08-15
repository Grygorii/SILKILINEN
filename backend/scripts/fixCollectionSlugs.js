'use strict';

// Repair malformed collection/category slugs already in the database.
//
// The models now normalise slugs on write (see the pre('save') hooks), but rows
// created before that shipped can still hold anything. One collection went live
// with an entire sentence as its URL:
//   /collections/a%20curated%20edit%20of%20silk%20robe,%20nightshirt,...
//
// Collections are safe to rewrite: the old slug moves into previousSlugs and
// /api/collections/:slug falls back to it, so the storefront 301s the old URL.
//
// Categories are REPORT-ONLY. A category slug is also the string stored on
// Product.category and there is no previousSlugs to redirect from, so renaming
// one silently orphans its products. Anything flagged here needs the products
// re-pointed too — which is what scripts/consolidateCategories.js is for.
//
// Usage (Railway shell):
//   node scripts/fixCollectionSlugs.js           # dry run — prints, changes nothing
//   node scripts/fixCollectionSlugs.js --apply   # writes

require('dotenv').config();
const mongoose = require('mongoose');
const Collection = require('../models/Collection');
const Category = require('../models/Category');
const { slugify } = require('../utils/slug');

const APPLY = process.argv.includes('--apply');

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(APPLY ? '── APPLYING ──\n' : '── DRY RUN (pass --apply to write) ──\n');

  const collections = await Collection.find({});
  const bad = collections.filter(c => c.slug !== slugify(c.slug));

  console.log(`Collections: ${collections.length} total, ${bad.length} malformed`);
  for (const c of bad) {
    const from = c.slug;
    // Prefer the NAME. Mechanically slugifying a malformed slug only makes it a
    // valid URL, not a good one — the sentence-slug above becomes a 97-char
    // keyword-stuffed hyphen chain, which is what Google reads as spam. The
    // name is short and human ("The Bridal Edite" -> the-bridal-edite).
    const fromName = slugify(c.name);
    const to = fromName || slugify(from);
    console.log(`\n  "${c.name}"`);
    console.log(`    from: ${from}  (${from.length} chars)`);
    console.log(`    to:   ${to}  (${to.length} chars, from ${fromName ? 'name' : 'old slug'})`);
    if (!to) {
      console.log('    SKIPPED — slugifies to empty; give this collection a real name/slug by hand.');
      continue;
    }
    if (APPLY) {
      // Assign + save so the model hook records previousSlugs and resolves any
      // uniqueness collision; it may land on `${to}-2` and that is fine.
      c.slug = to;
      await c.save();
      console.log(`    saved as: ${c.slug}  (old slug kept for redirect: ${c.previousSlugs.join(', ') || 'none'})`);
    }
  }

  const categories = await Category.find({});
  const badCats = categories.filter(c => c.slug !== slugify(c.slug));
  console.log(`\nCategories: ${categories.length} total, ${badCats.length} malformed`);
  for (const c of badCats) {
    console.log(`  "${c.label}"  ${c.slug}  →  would be  ${slugify(c.slug)}`);
  }
  if (badCats.length) {
    console.log('\n  REPORT ONLY — renaming a category slug orphans products that reference it.');
    console.log('  Use scripts/consolidateCategories.js so products are re-pointed in the same pass.');
  }

  await mongoose.disconnect();
  console.log(APPLY ? '\nDone.' : '\nDry run complete — nothing was written.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
