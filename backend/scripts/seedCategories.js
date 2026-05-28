'use strict';

/**
 * Seed the Category collection from backend/config/categories.js.
 * Idempotent — skips any slug that already exists.
 * Run with: node backend/scripts/seedCategories.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Category = require('../models/Category');
const { CATEGORIES } = require('../config/categories');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  for (let i = 0; i < CATEGORIES.length; i++) {
    const data = CATEGORIES[i];
    const existing = await Category.findOne({ slug: data.slug });
    if (existing) {
      console.log(`[skip] "${data.label}" (${data.slug}) already exists`);
      continue;
    }
    const cat = new Category({
      slug: data.slug,
      label: data.label,
      displayOrder: i,
      status: 'active',
    });
    await cat.save();
    console.log(`[created] "${data.label}" (${data.slug})`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
