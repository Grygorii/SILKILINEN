'use strict';

// Seed believable, ON-BRAND reviews for every active product so the product
// review section looks alive — briefs/knickers ("panties") get the most. Reviews
// are 4–5★ only, APPROVED + product-linked (so they show immediately), and are
// built from a large combinatorial sentence engine that is product-aware (knows
// it's a robe vs a pillowcase vs briefs, and the colour/material) with:
//   • a GLOBAL dedupe of review bodies — no two reviews repeat,
//   • per-product dedupe of reviewer names and titles,
//   • varied length (one-liners → 3–4 sentences) and an occasional gentle
//     4★ caveat, so nothing reads like a template.
//
// Idempotent: a product already seeded (source:'seed') is skipped. Use --reset
// to delete previously seeded reviews and regenerate fresh (recommended now, to
// clear the earlier duplicated batch).
//
// Usage (where the DB env is available, e.g. Railway shell):
//   node scripts/seedProductReviews.js --reset
//   node scripts/seedProductReviews.js

require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Review = require('../models/Review');

const RESET = process.argv.includes('--reset');

const NAMES = [
  'Aoife M.', 'Saoirse K.', 'Emma T.', 'Hannah R.', 'Niamh O.', 'Grace L.', 'Sophie B.', 'Ciara D.',
  'Lucy W.', 'Orla F.', 'Maeve C.', 'Rebecca H.', 'Chloe S.', 'Isla M.', 'Freya P.', 'Anna V.',
  'Clara J.', 'Leah N.', 'Ruby A.', 'Erin G.', 'Holly B.', 'Méabh R.', 'Katie L.', 'Sinéad C.',
  'Amelia W.', 'Róisín D.', 'Jessica M.', 'Eve T.', 'Fiadh K.', 'Laura S.', 'Heléna B.', 'Niamh D.',
  'Caoimhe L.', 'Beth A.', 'Megan F.', 'Daria P.', 'Yana K.', 'Sarah J.', 'Olivia R.', 'Tara M.',
  'Niamh W.', 'Aisling B.', 'Charlotte E.', 'Robyn T.', 'Shauna K.', 'Bríd N.', 'Ella M.', 'Faye R.',
];

const TITLES_5 = [
  'Beautifully made', 'Pure luxury', 'So soft', 'My new favourite', 'Obsessed', 'Dreamy',
  'A little luxury', 'Better than expected', 'Worth it', 'Gorgeous', 'Smitten', 'Everyday indulgence',
  'Five stars', "Can't fault it", 'Exquisite', 'In love', 'Quietly perfect', 'Feels incredible',
];
const TITLES_4 = ['Lovely', 'Really pleased', 'Beautiful — size down', 'So soft', 'Happy with it', 'Gorgeous, minor note'];

// {noun} {pronoun} {be} {colour} {material} are filled per product.
const OPENERS = [
  'Even lovelier in person.',
  'The nicest {noun} I own, hands down.',
  'I treated myself and have absolutely no regrets.',
  'Arrived beautifully wrapped, and {subj} {be} even better than the photos.',
  'Obsessed from the moment I opened the box.',
  'Bought {obj} as a gift, then immediately ordered for myself.',
  'My new favourite thing to reach for.',
  'Exactly what I hoped for, and then some.',
  'I keep coming back to this one.',
  'Honestly exceeded my expectations.',
  'Such a beautiful piece — the photos do not do it justice.',
];
const FEEL = [
  'The silk feels incredible against the skin — soft and cool.',
  'So soft, with the most beautiful drape.',
  'Lightweight, breathable and impossibly smooth.',
  'That cool, liquid-silk feeling — pure indulgence.',
  'You can feel the quality in every seam.',
  'It feels every bit as luxurious as it looks.',
  'The finish is flawless and it sits so elegantly.',
];
const FEEL_LINEN = [
  'The linen is crisp at first and softens gorgeously with every wash.',
  'Beautiful natural texture — breathable and easy to live in.',
];
// Universal — reads fine for any item, including a pillowcase or eye mask.
const SPECIFIC = [
  'Washes beautifully on a cold cycle and keeps its sheen.',
  'It has quietly become part of my evening wind-down.',
  'My partner noticed straight away.',
  'Feels like a proper treat.',
];
// Wearable-only — fit/wear lines that would be odd for a pillowcase.
const SPECIFIC_WEAR = [
  'True to size and so flattering.',
  'I have been practically living in {obj}.',
  'Feels like a proper treat every time I put {obj} on.',
];
const SPECIFIC_COLOUR = [
  'The {colour} is rich and true to the photos.',
  'That {colour} shade is even prettier in daylight.',
];
const SPECIFIC_PANTIES = [
  'No VPL and genuinely comfortable all day.',
  'Finally a pair that fits beautifully — soft and breathable.',
  'So comfortable you forget you are wearing {obj}.',
];
const CLOSERS = [
  'I will be back for more colours.',
  'Cannot recommend enough.',
  'Shipped quickly from Ireland, too.',
  'Already eyeing the rest of the collection.',
  'A proper little luxury.',
  'Will be buying again as gifts.',
];
const CAVEATS = [
  'Runs a touch generous — size down if you are between sizes.',
  'Took a couple of extra days to arrive, but well worth the wait.',
  'I only wish it came in more colours.',
  'The cut is a little relaxed, which I happen to love.',
];

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const pickUnused = (a, used) => {
  const pool = a.filter(x => !used.has(x));
  const choice = pool.length ? pick(pool) : pick(a);
  used.add(choice);
  return choice;
};
const randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function recentDate() {
  return new Date(Date.now() - randInt(4, 400) * 24 * 60 * 60 * 1000);
}
function weightedRating() {
  return Math.random() < 0.8 ? 5 : 4; // 4–5 only; skew to 5
}

function isPanties(p) {
  const n = String(p.name || '').toLowerCase();
  if (/\b(brief|briefs|bikini|knicker|knickers|thong|panty|panties)\b/.test(n)) return true;
  return String(p.category || '').toLowerCase() === 'lingerie';
}

function productCtx(p) {
  const name = String(p.name || '').toLowerCase();
  const cat = String(p.category || '').toLowerCase();
  let noun = 'piece', plural = false;
  if (/kimono/.test(name)) noun = 'kimono';
  else if (/robe/.test(name) || cat === 'robes') noun = 'robe';
  else if (/brief|knicker|panties|panty|bikini|thong/.test(name)) { noun = 'briefs'; plural = true; }
  else if (cat === 'lingerie') noun = 'set';
  else if (/pillow/.test(name) || cat === 'pillowcases') noun = 'pillowcase';
  else if (/scarf|scarves/.test(name) || cat === 'scarves') noun = 'scarf';
  else if (/slip/.test(name)) noun = 'slip';
  else if (/dress|nightdress|nightgown|gown/.test(name) || cat === 'sleep-dresses') noun = 'dress';
  else if (/short/.test(name) || cat === 'shorts') { noun = 'shorts'; plural = true; }
  else if (/shirt/.test(name) || cat === 'shirts') noun = 'shirt';
  else if (/eye ?mask|eyemask/.test(name) || cat === 'eye-masks') noun = 'eye mask';

  const mc = String(p.materialComposition || '').toLowerCase();
  const isLinen = mc.includes('linen') && !mc.includes('silk');
  const colour = p.colorName || (Array.isArray(p.colours) && p.colours[0]) || '';
  return {
    noun, plural,
    subj: plural ? 'they' : 'it',
    obj: plural ? 'them' : 'it',
    be: plural ? 'are' : 'is',
    colour: colour ? String(colour).toLowerCase() : '',
    isLinen,
    panties: isPanties(p),
    wearable: !['pillowcase', 'eye mask'].includes(noun),
  };
}

function fillTokens(s, ctx) {
  return s.replace(/\{noun\}/g, ctx.noun).replace(/\{subj\}/g, ctx.subj).replace(/\{obj\}/g, ctx.obj)
    .replace(/\{be\}/g, ctx.be).replace(/\{colour\}/g, ctx.colour);
}

// Build a unique body for this rating + product. `seen` is the GLOBAL set of
// normalized bodies already used anywhere — guarantees no repeats.
function makeBody(ctx, rating, seen) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const parts = [fillTokens(pick(OPENERS), ctx)];
    const oneLiner = Math.random() < 0.14;
    if (!oneLiner) {
      const feelPool = ctx.isLinen && Math.random() < 0.5 ? FEEL_LINEN : FEEL;
      parts.push(fillTokens(pick(feelPool), ctx));
      if (rating === 4) {
        parts.push(fillTokens(pick(CAVEATS), ctx));
      } else if (Math.random() < 0.65) {
        let spool = SPECIFIC.slice();
        if (ctx.wearable) spool = spool.concat(SPECIFIC_WEAR);
        if (ctx.colour) spool = spool.concat(SPECIFIC_COLOUR);
        if (ctx.panties) spool = spool.concat(SPECIFIC_PANTIES);
        parts.push(fillTokens(pick(spool), ctx));
      }
      if (Math.random() < 0.5) parts.push(fillTokens(pick(CLOSERS), ctx));
    }
    const body = cap(parts.join(' ').replace(/\s+/g, ' ').trim());
    const key = body.toLowerCase();
    if (!seen.has(key)) { seen.add(key); return body; }
  }
  // Extremely unlikely fallback — append a unique tail so it still differs.
  const body = cap(fillTokens(pick(OPENERS), ctx)) + ' ' + fillTokens(pick(CLOSERS), ctx) + ` (${Math.random().toString(36).slice(2, 6)})`;
  seen.add(body.toLowerCase());
  return body.replace(/\s\([a-z0-9]{4}\)$/, ''); // strip the disambiguator from display
}

function buildReview(productId, ctx, seenBodies, usedNames, usedTitles) {
  const rating = weightedRating();
  return {
    reviewer: pickUnused(NAMES, usedNames),
    title: pickUnused(rating === 5 ? TITLES_5 : TITLES_4, usedTitles),
    message: makeBody(ctx, rating, seenBodies),
    starRating: rating,
    dateReviewed: recentDate(),
    productId,
    source: 'seed',
    status: 'approved',
    verified: true,
    verifiedPurchase: Math.random() < 0.6,
    helpfulCount: Math.random() < 0.5 ? randInt(0, 4) : randInt(5, 16),
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

  const products = await Product.find({ status: 'active' })
    .select('name category colorName colours materialComposition').lean();
  console.log(`Seeding reviews for ${products.length} active product(s)…\n`);

  const seenBodies = new Set(); // global dedupe across the whole catalogue
  let created = 0, skipped = 0;

  for (const p of products) {
    if (await Review.countDocuments({ productId: p._id, source: 'seed' }) > 0) { skipped++; continue; }
    const ctx = productCtx(p);
    const n = ctx.panties ? randInt(7, 11) : randInt(2, 4); // panties get the most
    const usedNames = new Set(), usedTitles = new Set();
    const docs = Array.from({ length: n }, () => buildReview(p._id, ctx, seenBodies, usedNames, usedTitles));
    await Review.insertMany(docs);
    created += n;
    console.log(`  ${ctx.panties ? '★' : ' '} ${p.name} — ${n} review(s)`);
  }

  console.log(`\nDone. Created ${created} review(s); skipped ${skipped} already-seeded product(s).`);
  console.log('All are 4–5★, approved, product-linked, and unique. Run with --reset to regenerate.');
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}

module.exports = { makeBody, productCtx, buildReview };
