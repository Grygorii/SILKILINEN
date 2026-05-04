'use strict';

/**
 * Migrates product categories to the canonical slug list.
 * Run with: node backend/scripts/migrateCategories.js
 * Preview without changes: node backend/scripts/migrateCategories.js --dry-run
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const { SLUGS } = require('../config/categories');

const DRY_RUN = process.argv.includes('--dry-run');

// Map from old category values to new canonical slugs
const MIGRATION_MAP = {
  dresses: 'sleep-dresses',
  // Add more mappings here if needed, e.g.:
  // accessories: 'scarves',
  // sets: 'pyjamas',
};

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
  console.log(DRY_RUN ? '-- DRY RUN — no changes will be written --\n' : '-- LIVE RUN — changes will be saved --\n');

  // Show current distribution
  const allProducts = await Product.find({}).select('name category').lean();
  const dist = {};
  allProducts.forEach(p => {
    const c = p.category || '(none)';
    dist[c] = (dist[c] || 0) + 1;
  });

  console.log('Current category distribution:');
  Object.entries(dist).sort(([, a], [, b]) => b - a).forEach(([cat, n]) => {
    const mapped = MIGRATION_MAP[cat];
    const inCanonical = SLUGS.includes(cat);
    const tag = mapped ? ` → will migrate to "${mapped}"` : inCanonical ? ' ✓ canonical' : ' ⚠ NOT in canonical list — manual review needed';
    console.log(`  ${cat}: ${n} product(s)${tag}`);
  });
  console.log('');

  // Apply MIGRATION_MAP
  let totalMigrated = 0;
  for (const [from, to] of Object.entries(MIGRATION_MAP)) {
    const docs = await Product.find({ category: from }).select('_id name').lean();
    if (docs.length === 0) {
      console.log(`  "${from}" → "${to}": 0 products (skipping)`);
      continue;
    }
    console.log(`  "${from}" → "${to}": ${docs.length} product(s)`);
    docs.forEach(d => console.log(`    - ${d.name} (${d._id})`));

    if (!DRY_RUN) {
      await Product.updateMany({ category: from }, { $set: { category: to } });
    }
    totalMigrated += docs.length;
  }

  // Report anything still not in canonical list
  const remaining = await Product.distinct('category');
  const unmapped = remaining.filter(c => c && !SLUGS.includes(c));
  if (unmapped.length > 0) {
    console.log('\n⚠ Categories still not in canonical list after migration:');
    unmapped.forEach(c => console.log(`  "${c}" — add to MIGRATION_MAP or backend/config/categories.js`));
  } else {
    console.log('\n✓ All product categories are in the canonical list.');
  }

  console.log(`\n${DRY_RUN ? '[DRY RUN]' : 'Done.'} ${totalMigrated} product(s) would be${DRY_RUN ? '' : ' were'} migrated.`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
