/**
 * Audit script: find all broken image references in the database.
 * Run: node scripts/auditBrokenImages.js
 *
 * Broken = Gemini chat URL, non-HTTP string, or empty/missing URL.
 * Output: one line per broken reference. Pipe to a file for review.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Product = require('../models/Product');
const JournalArticle = require('../models/JournalArticle');

const GEMINI_RE = /gemini\.google\.com/i;

function isBroken(url) {
  if (!url || typeof url !== 'string') return true;
  if (!url.startsWith('http')) return true;
  if (GEMINI_RE.test(url)) return true;
  return false;
}

async function auditProducts() {
  const products = await Product.find({}, { _id: 1, name: 1, images: 1, image: 1 }).lean();
  let count = 0;

  for (const p of products) {
    if (!p.images || p.images.length === 0) {
      console.log(`PRODUCT NO IMAGES : ${p._id}  "${p.name}"`);
      count++;
      continue;
    }
    for (const img of p.images) {
      if (isBroken(img.url)) {
        const slot = img.slot ? `[slot:${img.slot}]` : `[order:${img.order ?? '?'}]`;
        console.log(`PRODUCT BROKEN    : ${p._id}  "${p.name}"  ${slot}  → ${img.url || '(empty)'}`);
        count++;
      }
    }
    // Legacy top-level image field (if still present)
    if (p.image && isBroken(p.image)) {
      console.log(`PRODUCT LEGACY    : ${p._id}  "${p.name}"  [image field]  → ${p.image}`);
      count++;
    }
  }

  return count;
}

async function auditJournal() {
  const articles = await JournalArticle.find({}, { _id: 1, title: 1, heroImage: 1, body: 1 }).lean();
  let count = 0;

  for (const a of articles) {
    if (isBroken(a.heroImage?.url)) {
      console.log(`JOURNAL HERO      : ${a._id}  "${a.title}"  → ${a.heroImage?.url || '(empty)'}`);
      count++;
    }
    // Scan HTML body for embedded Gemini URLs (img src or href)
    if (a.body && GEMINI_RE.test(a.body)) {
      const matches = a.body.match(/https?:\/\/[^\s"'>]+gemini\.google\.com[^\s"'>]*/gi) || [];
      for (const url of matches) {
        console.log(`JOURNAL BODY      : ${a._id}  "${a.title}"  → ${url}`);
        count++;
      }
    }
  }

  return count;
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected. Scanning...\n');

  const productCount = await auditProducts();
  const journalCount = await auditJournal();

  const total = productCount + journalCount;
  console.log(`\n─────────────────────────────────────────`);
  console.log(`Total broken references: ${total}`);
  console.log(`  Products: ${productCount}`);
  console.log(`  Journal:  ${journalCount}`);

  if (total === 0) {
    console.log('\nAll clean — no broken image references found.');
  } else {
    console.log('\nFix these via the admin panel (re-upload the image through the file picker).');
  }

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
