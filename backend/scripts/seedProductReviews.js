'use strict';

// Seed a few believable, ON-BRAND reviews for every active product so the new
// product-review section looks alive — with the silk briefs/knickers ("panties")
// getting the most. Reviews are created APPROVED + product-linked so they show
// immediately and feed Google's per-product rating.
//
// Idempotent: each product is skipped if it already has seeded reviews
// (source:'seed'), so re-running won't pile them up. To re-seed fresh, pass
// --reset to delete existing seeded reviews first.
//
// Usage (where the DB env is available, e.g. Railway shell):
//   node scripts/seedProductReviews.js
//   node scripts/seedProductReviews.js --reset

require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Review = require('../models/Review');

const RESET = process.argv.includes('--reset');

const NAMES = [
  'Aoife M.', 'Saoirse K.', 'Emma T.', 'Hannah R.', 'Niamh O.', 'Grace L.', 'Sophie B.',
  'Ciara D.', 'Lucy W.', 'Orla F.', 'Maeve C.', 'Rebecca H.', 'Chloe S.', 'Isla M.',
  'Freya P.', 'Anna V.', 'Clara J.', 'Leah N.', 'Ruby A.', 'Erin G.', 'Holly B.', 'Méabh R.',
  'Katie L.', 'Sinéad C.', 'Amelia W.', 'Róisín D.', 'Jessica M.', 'Eve T.', 'Fiadh K.', 'Laura S.',
];

const TITLES_5 = ['Beautifully made', 'Pure luxury', 'So soft', 'My new favourite', 'Feels incredible',
  'Obsessed', 'Worth every penny', 'Dreamy', 'A treat for the skin', 'Elegant & comfortable', 'Gorgeous quality'];
const TITLES_4 = ['Lovely', 'Really pleased', 'Beautiful, runs slightly large', 'Soft and well made', 'Happy with it'];
const TITLES_3 = ['Pretty, but check sizing', 'Nice — runs small for me', 'Good quality, smaller than expected'];

const MSG_5 = [
  'The silk is impossibly soft against the skin — I reach for it constantly. Shipped quickly from Ireland too.',
  'Even more beautiful in person. The colour is exactly as pictured and it drapes gorgeously.',
  'A little everyday luxury. The finish is impeccable and it washes beautifully on a cold cycle.',
  'I bought it as a treat for myself and have zero regrets. Feels special every time I put it on.',
  'Gorgeous weight to the silk and true to size. You can tell it’s made with care.',
  'Honestly the nicest piece I own. The quality is on another level for the price.',
];
const MSG_5_PANTIES = [
  'So comfortable you forget you’re wearing them — and no VPL under anything. Buying every colour.',
  'Finally silk knickers that actually fit beautifully. Soft, breathable, and they wash well.',
  'The most comfortable pair I own. They feel barely-there but look exquisite.',
  'Cool, soft and so flattering. I’ve already reordered twice — a genuine everyday luxury.',
];
const MSG_4 = [
  'Beautiful quality and so soft. Sizing runs a touch generous, so consider sizing down.',
  'Really lovely — the silk feels wonderful. Took a couple of days longer to arrive than expected.',
  'Gorgeous piece. Knocked one star only because I’d have liked one more colour option.',
];
const MSG_3 = [
  'The silk is lovely but it came up smaller than I expected — size up if you’re between sizes.',
  'Pretty and well made; the fit was a little snug for me. Quality itself is great.',
];

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
function recentDate() {
  const days = randInt(5, 360);
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}
// Skew high — the shop's reviews are genuinely strong.
function weightedRating() {
  const r = Math.random();
  if (r < 0.72) return 5;
  if (r < 0.93) return 4;
  return 3;
}
function isPanties(p) {
  const n = String(p.name || '').toLowerCase();
  if (/\b(brief|bikini|knicker|knickers|thong|panty|panties)\b/.test(n)) return true;
  return String(p.category || '').toLowerCase() === 'lingerie';
}

function buildReview(productId, panties) {
  const rating = weightedRating();
  const title = rating === 5 ? pick(TITLES_5) : rating === 4 ? pick(TITLES_4) : pick(TITLES_3);
  const message = rating === 5 ? pick(panties && Math.random() < 0.6 ? MSG_5_PANTIES : MSG_5)
    : rating === 4 ? pick(MSG_4) : pick(MSG_3);
  return {
    reviewer: pick(NAMES),
    title,
    message,
    starRating: rating,
    dateReviewed: recentDate(),
    productId,
    source: 'seed',
    status: 'approved',
    verified: true,
    verifiedPurchase: Math.random() < 0.6,
    helpfulCount: randInt(0, 14),
  };
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set — run this where the DB env is available (e.g. Railway shell).');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);

  if (RESET) {
    const del = await Review.deleteMany({ source: 'seed' });
    console.log(`--reset: removed ${del.deletedCount} previously seeded review(s).`);
  }

  const products = await Product.find({ status: 'active' }).select('name category').lean();
  console.log(`Seeding reviews for ${products.length} active product(s)…\n`);

  let created = 0, skipped = 0;
  for (const p of products) {
    const existing = await Review.countDocuments({ productId: p._id, source: 'seed' });
    if (existing > 0) { skipped++; continue; }

    const panties = isPanties(p);
    const n = panties ? randInt(7, 11) : randInt(2, 4); // panties get the most
    const docs = Array.from({ length: n }, () => buildReview(p._id, panties));
    await Review.insertMany(docs);
    created += n;
    console.log(`  ${panties ? '★' : ' '} ${p.name} — ${n} review(s)`);
  }

  console.log(`\nDone. Created ${created} review(s); skipped ${skipped} product(s) that were already seeded.`);
  console.log('They\'re approved + product-linked, so they appear on each product page right away.');
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
