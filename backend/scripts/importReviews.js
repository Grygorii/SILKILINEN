/**
 * One-time script: imports Etsy reviews from backend/data/reviews.json into MongoDB.
 *
 * Place your Etsy review JSON file at:  backend/data/reviews.json
 * Then run: cd backend && node scripts/importReviews.js
 *
 * Expected JSON format (any of these field names are accepted):
 *   reviewer  : "Buyer", "Name", "Reviewer", "Author"
 *   message   : "Review", "Message", "Comments", "Body"
 *   starRating: "Rating", "Star Rating", "Stars", "Score"
 *   dateReviewed: "Date", "Date Created", "Created", "Date Reviewed"
 *   orderId   : "Order ID", "OrderID", "orderId", "order_id"
 *
 * Example:
 *   [
 *     { "Buyer": "Sarah M.", "Review": "Gorgeous quality!", "Rating": 5, "Date": "Dec 14, 2023", "Order ID": "12345678" },
 *     ...
 *   ]
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Review = require('../models/Review');

const DATA_PATH = path.join(__dirname, '../data/reviews.json');

function pick(obj, candidates) {
  for (const key of candidates) {
    const val = obj[key];
    if (val !== undefined && val !== null && String(val).trim() !== '') return val;
  }
  return null;
}

function mapRow(row) {
  const reviewer = pick(row, ['Buyer', 'buyer', 'Name', 'name', 'Reviewer', 'reviewer', 'Author', 'author']) || 'Anonymous';
  const message  = pick(row, ['Review', 'review', 'Message', 'message', 'Comments', 'comments', 'Body', 'body', 'Text', 'text']) || '';
  const rating   = pick(row, ['Rating', 'rating', 'Star Rating', 'starRating', 'Stars', 'stars', 'Score', 'score']);
  const date     = pick(row, ['Date', 'date', 'Date Created', 'dateCreated', 'Created', 'created', 'Date Reviewed', 'dateReviewed', 'ReviewDate']);
  const orderId  = pick(row, ['Order ID', 'orderId', 'order_id', 'OrderID', 'orderid']);

  const parsed = {
    reviewer:     String(reviewer).trim(),
    message:      String(message).trim(),
    starRating:   Math.min(5, Math.max(1, parseInt(rating) || 5)),
    dateReviewed: date ? new Date(date) : new Date(),
    orderId:      orderId ? parseInt(String(orderId).replace(/\D/g, '')) || undefined : undefined,
    source:       'etsy',
    verified:     true,
  };

  if (isNaN(parsed.dateReviewed.getTime())) parsed.dateReviewed = new Date();
  return parsed;
}

async function run() {
  if (!fs.existsSync(DATA_PATH)) {
    console.error(`\n  reviews.json not found at: ${DATA_PATH}`);
    console.error('  Place your Etsy reviews JSON file there and re-run this script.\n');
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  if (!Array.isArray(raw) || raw.length === 0) {
    console.error('  reviews.json must be a non-empty JSON array.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Show detected field names from first row
  const sample = raw[0];
  console.log('\nDetected fields in first row:', Object.keys(sample).join(', '));

  const docs = raw.map(mapRow).filter(d => d.starRating >= 1 && d.reviewer);

  let inserted = 0;
  let skipped  = 0;

  for (const doc of docs) {
    const exists = doc.orderId
      ? await Review.findOne({ orderId: doc.orderId })
      : await Review.findOne({ reviewer: doc.reviewer, message: doc.message });

    if (exists) { skipped++; continue; }

    await Review.create(doc);
    inserted++;
  }

  console.log(`\nDone — inserted: ${inserted}, skipped (duplicates): ${skipped}`);
  await mongoose.connection.close();
}

run().catch(err => { console.error(err); process.exit(1); });
