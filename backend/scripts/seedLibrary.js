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
