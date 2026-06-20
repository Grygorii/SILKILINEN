/**
 * Audit (and optionally FIX) broken image references in the database.
 *
 * Usage:
 *   node scripts/auditBrokenImages.js           — pattern-only report (fast)
 *   node scripts/auditBrokenImages.js --verify  — also HEAD-check Cloudinary URLs (slower)
 *   node scripts/auditBrokenImages.js --fix      — verify, then REMOVE dead product image
 *                                                  refs from the DB (so galleries show only
 *                                                  real photos). --fix implies --verify.
 *
 * Broken = Gemini chat URL, non-HTTP string, empty/missing, or a Cloudinary URL that
 * returns a definitive 4xx (gone/forbidden). Transient errors (timeout, 5xx) are
 * reported but NEVER auto-removed.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const https = require('https');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const JournalArticle = require('../models/JournalArticle');

const GEMINI_RE = /gemini\.google\.com/i;
const FIX = process.argv.includes('--fix');
const VERIFY = process.argv.includes('--verify') || FIX; // --fix needs the HEAD check

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

function isCloudinaryUrl(url) {
  return typeof url === 'string' && url.includes('res.cloudinary.com');
}

// A definitive 4xx means the file is genuinely gone/forbidden → safe to remove.
// 0 (timeout/network) and 5xx (server) are transient → report only, never remove.
const isDefinitivelyDead = status => status >= 400 && status < 500;

async function auditProducts() {
  const products = await Product.find({}, { _id: 1, name: 1, images: 1, image: 1 });
  let count = 0;
  let fixedProducts = 0;
  let fixedRefs = 0;

  for (const p of products) {
    if (!p.images || p.images.length === 0) {
      console.log(`PRODUCT NO IMAGES : ${p._id}  "${p.name}"`);
      count++;
      continue;
    }

    const removeIds = [];
    for (const img of p.images) {
      const slot = img.slot ? `[slot:${img.slot}]` : `[order:${img.order ?? '?'}]`;
      if (isBroken(img.url)) {
        console.log(`PRODUCT BROKEN    : ${p._id}  "${p.name}"  ${slot}  → ${img.url || '(empty)'}`);
        count++;
        removeIds.push(img._id);
      } else if (VERIFY && isCloudinaryUrl(img.url)) {
        const status = await headRequest(img.url);
        if (status === 0 || status >= 400) {
          console.log(`PRODUCT 404       : ${p._id}  "${p.name}"  ${slot}  [HTTP ${status || 'ERR'}]  → ${img.url}`);
          count++;
          if (isDefinitivelyDead(status)) removeIds.push(img._id);
          else if (FIX) console.log(`  ↳ kept (transient HTTP ${status || 'ERR'}, not auto-removed)`);
        }
      }
    }

    // Legacy top-level image field.
    let unsetLegacy = false;
    if (p.image && isBroken(p.image)) {
      console.log(`PRODUCT LEGACY    : ${p._id}  "${p.name}"  [image field]  → ${p.image}`);
      count++; unsetLegacy = true;
    } else if (VERIFY && isCloudinaryUrl(p.image)) {
      const status = await headRequest(p.image);
      if (status === 0 || status >= 400) {
        console.log(`PRODUCT LEGACY 404: ${p._id}  "${p.name}"  [image field]  → ${p.image} [HTTP ${status || 'ERR'}]`);
        count++; if (isDefinitivelyDead(status)) unsetLegacy = true;
      }
    }

    if (FIX && (removeIds.length || unsetLegacy)) {
      const update = {};
      if (removeIds.length) update.$pull = { images: { _id: { $in: removeIds } } };
      if (unsetLegacy) update.$unset = { image: '' };
      await Product.updateOne({ _id: p._id }, update);
      fixedProducts++; fixedRefs += removeIds.length + (unsetLegacy ? 1 : 0);
      const left = p.images.length - removeIds.length;
      console.log(`  ↳ FIXED: removed ${removeIds.length + (unsetLegacy ? 1 : 0)} dead ref(s) from "${p.name}"${left === 0 ? '  ⚠ now has NO images — re-upload one' : `  (${left} valid photo(s) left)`}`);
    }
  }

  if (FIX) console.log(`\n[fix] pruned ${fixedRefs} dead ref(s) across ${fixedProducts} product(s).`);
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
    } else if (VERIFY && isCloudinaryUrl(heroUrl)) {
      const status = await headRequest(heroUrl);
      if (status === 0 || status >= 400) { console.log(`JOURNAL HERO 404  : ${a._id}  "${a.title}"  → ${heroUrl} [HTTP ${status || 'ERR'}]`); count++; }
    }
    if (a.body && GEMINI_RE.test(a.body)) {
      const matches = a.body.match(/https?:\/\/[^\s"'>]+gemini\.google\.com[^\s"'>]*/gi) || [];
      for (const url of matches) { console.log(`JOURNAL BODY      : ${a._id}  "${a.title}"  → ${url}`); count++; }
    }
  }
  return count;
}

async function run() {
  if (FIX) console.log('Mode: --fix  (HEAD-checking Cloudinary URLs, then removing dead product refs)\n');
  else if (VERIFY) console.log('Mode: --verify  (HEAD-checking all Cloudinary URLs — this may take a minute)\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected. Scanning...\n');

  const productCount = await auditProducts();
  const journalCount = await auditJournal(); // journal is report-only even under --fix

  const total = productCount + journalCount;
  console.log(`\n─────────────────────────────────────────`);
  console.log(`Total broken references: ${total}   (Products: ${productCount}, Journal: ${journalCount})`);
  if (total === 0) console.log('\nAll clean — no broken image references found.');
  else if (!FIX) console.log('\nRun with --fix to auto-remove the dead product refs, or re-upload via the admin panel.');

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
