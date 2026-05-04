/**
 * Migration: flat colours/sizes/stockLevel → variants + images + status
 *
 * Run once after deploying the new Product schema:
 *   cd backend
 *   node scripts/migrateProductsToVariants.js
 *
 * Safe to re-run (skips products that already have variants).
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Product = require('../models/Product');

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function buildSku(name, colour, size) {
  const parts = ['SLK'];
  if (name) parts.push(name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase());
  if (colour) parts.push(colour.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase());
  if (size) parts.push(size.replace(/\s/g, '').toUpperCase());
  return parts.join('-');
}

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const products = await Product.find({}).lean();
  console.log(`Found ${products.length} products`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const raw of products) {
    try {
      const doc = await Product.findById(raw._id);

      // Skip if already has variants
      if (doc.variants && doc.variants.length > 0) {
        skipped++;
        continue;
      }

      const colours = raw.colours || [];
      const sizes = raw.sizes || [];
      const baseStock = raw.stockLevel || 0;

      // Build variant combinations
      const pairs = [];
      if (colours.length > 0 && sizes.length > 0) {
        for (const c of colours) {
          for (const s of sizes) pairs.push([c, s]);
        }
      } else if (colours.length > 0) {
        for (const c of colours) pairs.push([c, '']);
      } else if (sizes.length > 0) {
        for (const s of sizes) pairs.push(['', s]);
      } else {
        pairs.push(['', '']);
      }

      // Distribute stock evenly, remainder goes to first variant
      const perVariant = pairs.length > 0 ? Math.floor(baseStock / pairs.length) : 0;
      const remainder = pairs.length > 0 ? baseStock % pairs.length : 0;

      doc.variants = pairs.map(([colour, size], idx) => ({
        sku: buildSku(raw.name, colour, size),
        colour,
        size,
        stockLevel: perVariant + (idx === 0 ? remainder : 0),
        lowStockThreshold: 3,
      }));

      // Migrate legacy image field → images array
      if (raw.image && doc.images.length === 0) {
        doc.images = [{
          url: raw.image,
          alt: raw.altText || '',
          isPrimary: true,
          order: 0,
        }];
      }

      // Set status based on current active state (assume active if it had a price)
      if (!doc.status || doc.status === 'draft') {
        doc.status = 'active';
      }

      // Generate slug if missing
      if (!doc.slug) {
        doc.slug = slugify(raw.name);
      }

      await doc.save();
      console.log(`  ✓ ${raw.name} — ${doc.variants.length} variant(s) created`);
      migrated++;
    } catch (err) {
      console.error(`  ✕ ${raw.name}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\nMigration complete: ${migrated} migrated, ${skipped} skipped (already had variants), ${errors} errors`);
  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
