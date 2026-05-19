/**
 * Audit script: find all broken image references in the database.
 *
 * Usage:
 *   node scripts/auditBrokenImages.js           — pattern-only (fast)
 *   node scripts/auditBrokenImages.js --verify  — also HEAD-check Cloudinary URLs (slower)
 *
 * Broken = Gemini chat URL, non-HTTP string, empty/missing, or Cloudinary URL that 404s.
 * Output: one line per broken reference. Pipe to a file for review.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const https = require('https');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const JournalArticle = require('../models/JournalArticle');

const GEMINI_RE = /gemini\.google\.com/i;
const VERIFY = process.argv.includes('--verify');

function isBroken(url) {
  if (!url || typeof url !== 'string') return true;
  if (!url.startsWith('http')) return true;
  if (GEMINI_RE.test(url)) return true;
  return false;
}

/** HEAD request to url. Returns status code, or 0 on timeout/error. */
function headRequest(url) {
  return new Promise(resolve => {
    try {
      const parsed = new URL(url);
      const req = https.request(
        { hostname: parsed.hostname, path: parsed.pathname + parsed.search, method: 'HEAD', timeout: 10000 },
        res => resolve(res.statusCode),
      );
      req.on('timeout', () => { req.destroy(); resolve(0); });
      req.on('error', () => resolve(0));
      req.end();
    } catch {
      resolve(0);
    }
  });
}

/** Returns true if the URL is a Cloudinary URL that should be verified. */
function isCloudinaryUrl(url) {
  return typeof url === 'string' && url.includes('res.cloudinary.com');
}

async function checkUrl(url, label) {
  if (!VERIFY || !isCloudinaryUrl(url)) return false;
  const status = await headRequest(url);
  if (status === 0 || status >= 400) {
    console.log(`${label}  [HTTP ${status || 'ERR'}]`);
    return true;
  }
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
      const slot = img.slot ? `[slot:${img.slot}]` : `[order:${img.order ?? '?'}]`;
      if (isBroken(img.url)) {
        console.log(`PRODUCT BROKEN    : ${p._id}  "${p.name}"  ${slot}  → ${img.url || '(empty)'}`);
        count++;
      } else {
        const label = `PRODUCT 404       : ${p._id}  "${p.name}"  ${slot}  → ${img.url}`;
        if (await checkUrl(img.url, label)) count++;
      }
    }
    // Legacy top-level image field (if still present)
    if (p.image && isBroken(p.image)) {
      console.log(`PRODUCT LEGACY    : ${p._id}  "${p.name}"  [image field]  → ${p.image}`);
      count++;
    } else if (p.image) {
      const label = `PRODUCT LEGACY 404: ${p._id}  "${p.name}"  [image field]  → ${p.image}`;
      if (await checkUrl(p.image, label)) count++;
    }
  }

  return count;
}

async function auditJournal() {
  const articles = await JournalArticle.find({}, { _id: 1, title: 1, heroImage: 1, body: 1 }).lean();
  let count = 0;

  for (const a of articles) {
    const heroUrl = a.heroImage?.url;
    if (isBroken(heroUrl)) {
      console.log(`JOURNAL HERO      : ${a._id}  "${a.title}"  → ${heroUrl || '(empty)'}`);
      count++;
    } else if (heroUrl) {
      const label = `JOURNAL HERO 404  : ${a._id}  "${a.title}"  → ${heroUrl}`;
      if (await checkUrl(heroUrl, label)) count++;
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
  if (VERIFY) {
    console.log('Mode: --verify  (HEAD-checking all Cloudinary URLs — this may take a minute)\n');
  }

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
