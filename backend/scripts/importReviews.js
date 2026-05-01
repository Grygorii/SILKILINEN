/**
 * One-time import: reads backend/data/reviews.json and inserts reviews into MongoDB.
 * Run: cd backend && node scripts/importReviews.js
 *
 * Expected field names: reviewer, date_reviewed, star_rating, message, order_id
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Review = require('../models/Review');

const DATA_PATH = path.join(__dirname, '../data/reviews.json');

async function run() {
  if (!fs.existsSync(DATA_PATH)) {
    console.error(`\n  File not found: ${DATA_PATH}`);
    console.error('  Place reviews.json in backend/data/ and re-run.\n');
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  if (!Array.isArray(raw) || raw.length === 0) {
    console.error('  reviews.json must be a non-empty JSON array.');
    process.exit(1);
  }

  console.log(`Found ${raw.length} records. Connecting to MongoDB…`);
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.\n');

  let inserted = 0;
  let skipped  = 0;
  let invalid  = 0;

  for (const row of raw) {
    const starRating = parseInt(row.star_rating);
    if (!row.reviewer || isNaN(starRating)) { invalid++; continue; }

    const doc = {
      reviewer:     String(row.reviewer).trim(),
      message:      row.message ? String(row.message).trim() : '',
      starRating:   Math.min(5, Math.max(1, starRating)),
      dateReviewed: row.date_reviewed ? new Date(row.date_reviewed) : new Date(),
      orderId:      row.order_id ? parseInt(String(row.order_id).replace(/\D/g, '')) || undefined : undefined,
      source:       'etsy',
      verified:     true,
    };

    if (isNaN(doc.dateReviewed.getTime())) doc.dateReviewed = new Date();

    const exists = doc.orderId
      ? await Review.findOne({ orderId: doc.orderId })
      : await Review.findOne({ reviewer: doc.reviewer, message: doc.message });

    if (exists) { skipped++; continue; }

    await Review.create(doc);
    inserted++;
  }

  console.log(`Done.`);
  console.log(`  Inserted : ${inserted}`);
  console.log(`  Skipped  : ${skipped} (duplicates)`);
  if (invalid) console.log(`  Invalid  : ${invalid} (missing reviewer or star_rating)`);

  await mongoose.connection.close();
}

run().catch(err => { console.error(err.message); process.exit(1); });
