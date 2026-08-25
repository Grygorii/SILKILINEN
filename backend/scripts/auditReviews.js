/**
 * Read-only: is the review data telling one story?
 *
 * An outside review of the live site reported "inconsistent review totals and
 * repeated review entries". Neither is visible from the repository — the counts
 * are computed from the database at request time — so this reports what the
 * data actually says, rather than anyone guessing from the code.
 *
 * Four questions, because they have different fixes:
 *
 *   1. DUPLICATES. There are two writers of reviews (seedProductReviews.js and
 *      importReviews.js) and no uniqueness constraint on the collection, so the
 *      same review can exist twice. A duplicate inflates the count AND pulls
 *      the average toward whatever it says — and that average feeds
 *      aggregateRating in the product JSON-LD, which is a claim made to Google.
 *
 *   2. THE HEADLINE FIGURE. Recomputed here exactly as /api/reviews/summary
 *      does — every approved review at any rating. If the site is showing
 *      something else, the difference is caching or a second computation
 *      somewhere, and knowing the true number is how you tell which.
 *
 *   3. ORPHANS. A review whose productId points at a product that no longer
 *      exists still counts toward the brand average while being unreachable
 *      from any page — invisible and load-bearing.
 *
 *   4. UNATTACHED. productId null. These count brand-wide but appear on no
 *      product, so a PDP can show fewer reviews than the customer expects.
 *
 * Reports, never writes: deleting a customer's review is not something a script
 * should decide.
 *
 *   node scripts/auditReviews.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Review = require('../models/Review');
const Product = require('../models/Product');

// What makes two rows "the same review". Deliberately not the _id: a duplicate
// import creates a new _id, which is exactly why duplicates survive.
function fingerprint(r) {
  return [
    String(r.productId || 'none'),
    (r.reviewer || '').trim().toLowerCase(),
    (r.message || '').trim().toLowerCase().slice(0, 120),
    r.starRating,
  ].join(' | ');
}

async function run() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected. Auditing reviews…\n');

  const all = await Review.find({}).select('productId reviewer message starRating status source dateReviewed').lean();
  const approved = all.filter(r => r.status === 'approved');

  // ── 1. Duplicates ──
  const seen = new Map();
  for (const r of all) {
    const key = fingerprint(r);
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push(r);
  }
  const dupes = [...seen.values()].filter(g => g.length > 1);

  console.log(`── Duplicates ── ${dupes.length} group${dupes.length === 1 ? '' : 's'}`);
  if (!dupes.length) console.log('   none — same reviewer, text and rating never appears twice');
  for (const group of dupes.slice(0, 15)) {
    const [first] = group;
    console.log(`\n   ${group.length}× "${(first.message || '').replace(/\s+/g, ' ').slice(0, 70)}…"`);
    console.log(`   by ${first.reviewer} · ${first.starRating}★ · sources: ${group.map(g => g.source || 'none').join(', ')}`);
    console.log(`   ids: ${group.map(g => String(g._id)).join(', ')}`);
  }
  if (dupes.length > 15) console.log(`\n   …and ${dupes.length - 15} more groups`);

  // ── 2. The headline figure ──
  // Computed exactly as routes/reviews.js /summary does. If the site shows
  // something different, the cause is caching or a second computation.
  const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let sum = 0;
  for (const r of approved) {
    dist[r.starRating] = (dist[r.starRating] || 0) + 1;
    sum += r.starRating;
  }
  const average = approved.length ? Math.round((sum / approved.length) * 10) / 10 : 0;

  console.log(`\n\n── The canonical figure ──`);
  console.log(`   ${average} from ${approved.length} approved reviews (${all.length} total, all statuses)`);
  console.log(`   distribution: ${[5, 4, 3, 2, 1].map(n => `${n}★ ${dist[n]}`).join(' · ')}`);
  console.log('   This is what /api/reviews/summary returns and what the site should show.');

  // What the average would be without the duplicates, so the cost is a number
  // rather than a worry.
  if (dupes.length) {
    const extra = dupes.reduce((n, g) => n + g.length - 1, 0);
    const deduped = [];
    const kept = new Set();
    for (const r of approved) {
      const k = fingerprint(r);
      if (kept.has(k)) continue;
      kept.add(k);
      deduped.push(r);
    }
    const dedupSum = deduped.reduce((n, r) => n + r.starRating, 0);
    const dedupAvg = deduped.length ? Math.round((dedupSum / deduped.length) * 10) / 10 : 0;
    console.log(`\n   Without duplicates: ${dedupAvg} from ${deduped.length} (${extra} extra row${extra === 1 ? '' : 's'} across all statuses).`);
    console.log('   That difference is currently being asserted to Google via aggregateRating.');
  }

  // ── 3 & 4. Attachment ──
  const productIds = new Set((await Product.find({}).select('_id').lean()).map(p => String(p._id)));
  const orphans = approved.filter(r => r.productId && !productIds.has(String(r.productId)));
  const unattached = approved.filter(r => !r.productId);

  console.log(`\n\n── Attachment ──`);
  console.log(`   ${unattached.length} approved review(s) with no product — counted brand-wide, shown on no product page`);
  console.log(`   ${orphans.length} approved review(s) pointing at a product that no longer exists`);
  for (const o of orphans.slice(0, 10)) {
    console.log(`     · ${o.reviewer} — productId ${o.productId} (missing)`);
  }

  console.log('\n\nNothing was changed. Deleting a customer review is not a decision a');
  console.log('script should make — but a duplicate created by running an import twice');
  console.log('is safe to remove, and the ids above say which rows they are.');

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
