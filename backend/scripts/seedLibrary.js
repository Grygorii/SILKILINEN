'use strict';

// Seed the Archivarius Library with a couple of starter references so the agents
// have authoritative guidance immediately — and so the shelf shows how a LINK
// and a BOOK entry look. Idempotent (deduped by source). Edit/add more in
// Admin → Archivarius → Library.
//
// Usage (where the DB env is available, e.g. Railway shell):
//   node scripts/seedLibrary.js

require('dotenv').config();
const mongoose = require('mongoose');
const { addReference } = require('../services/archivarius');

const ENTRIES = [
  {
    title: 'Google SEO Starter Guide',
    refType: 'link',
    refSource: 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide',
    tags: ['seo', 'content'],
    text: [
      'Write a unique, descriptive <title> per page led by the primary term (~50–60 chars); keep exactly one <h1>.',
      'Write a unique meta description (~120–160 chars) that genuinely summarises the page.',
      'Use descriptive, readable URLs (slugs), and add descriptive alt text + good filenames to content images.',
      'Give the site a logical structure with clear navigation and breadcrumbs (BreadcrumbList structured data).',
      'Write helpful, people-first content using the words shoppers actually search; use Product/Article structured data for rich results.',
      'Keep pages crawlable (sitemap, real <a href> links, no accidental noindex/robots blocks) and mobile-friendly.',
      'Avoid keyword stuffing, hidden text, and thin or duplicate pages (use canonical); meta keywords are ignored by Google.',
    ].join(' '),
  },
  {
    title: 'Building a StoryBrand',
    refType: 'book',
    refSource: 'Donald Miller',
    tags: ['content', 'marketing', 'email'],
    text: [
      'Make the CUSTOMER the hero and the brand the guide — lead with her problem and the transformation she wants, not product features.',
      'Open with a clear one-liner: problem → solution → success.',
      'Give every page one obvious primary call-to-action, repeated consistently.',
      'Cut anything that does not help her act; show both the stakes (what she avoids) and the happy ending (how life feels with the piece).',
    ].join(' '),
  },
  {
    title: 'Ogilvy on Advertising',
    refType: 'book',
    refSource: 'David Ogilvy',
    tags: ['content', 'marketing', 'email', 'copywriting'],
    text: [
      'Sell the benefit, and prove it with SPECIFICS — concrete facts ("22-momme mulberry silk, hand-finished in Donegal") outsell vague adjectives ("luxurious", "premium").',
      'The headline does most of the work; make it about the reader\'s desire or problem, and if it does not pull her into the next line, the rest is wasted.',
      'Long copy sells when every line earns its place — give a considered buyer the full story, but never pad.',
      'Write the way you speak: clear, warm, specific; avoid superlatives, generalisations and clichés.',
      'Respect the reader — she is intelligent; do not shout, exaggerate, or talk down.',
    ].join(' '),
  },
  {
    title: 'Google — Product structured data',
    refType: 'link',
    refSource: 'https://developers.google.com/search/docs/appearance/structured-data/product',
    tags: ['seo', 'content'],
    text: [
      'Add Product structured data — name, image, description, brand, and an offers block with price, priceCurrency and availability — so listings qualify for rich results.',
      'Every value in the markup MUST match what the shopper sees on the page (same price, currency, availability) — mismatches get the rich result removed.',
      'Use AggregateRating / Review markup ONLY from genuine, on-page customer reviews; never invent ratings — fabricated reviews are a manual-action risk.',
      'Set offers.availability accurately (InStock / OutOfStock / PreOrder); include shipping and return details for the merchant listing experience.',
      'One Product entity per product page; do not mark up products that are not the main subject of the page.',
    ].join(' '),
  },
  {
    title: 'Silk craft primer — momme, mulberry & weave',
    refType: 'book',
    refSource: 'Textile craft reference (founder knowledge)',
    tags: ['product', 'content', 'craft'],
    text: [
      'Momme (mm) is silk\'s weight/density: ~19–22mm is the sweet spot for robes & slips (substantial, opaque, beautiful drape); 22–25mm is luxe bedding weight; under 16mm reads thin and cheap.',
      'Mulberry silk is the highest grade — long, uniform fibres from the Bombyx mori silkworm — giving the smooth lustre and strength; only say "mulberry" when it is genuinely mulberry.',
      'Weave matters: charmeuse is the satin weave used for slips & robes (glossy face, matte back); habotai is a lighter plain weave; crêpe de chine has a fine pebbled texture.',
      'Care, stated honestly: hand-wash cool with a pH-neutral silk detergent, never wring, dry flat out of direct sun — silk is a protein fibre, so bleach and high heat destroy it.',
      'The quality signals a discerning silk buyer looks for, and that copy should state plainly: momme weight, mulberry grade, weave, and country of origin.',
    ].join(' '),
  },
];

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set — run this where the DB env is available (e.g. Railway shell).');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  for (const e of ENTRIES) {
    await addReference({ ...e, source: 'founder (seed)' });
    console.log(`  + ${e.refType}: ${e.title}`);
  }
  console.log(`\nDone — ${ENTRIES.length} reference(s) in the Library. See Admin → Archivarius → Library.`);
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
