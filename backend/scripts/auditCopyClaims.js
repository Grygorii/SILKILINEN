/**
 * Read-only: find every forbidden origin claim in the LIVE database.
 *
 * The code in this repo is only half the copy. The other half — the half a
 * customer actually reads — lives in MongoDB: SiteContent values the founder
 * edited in admin, product descriptions, AI-generated meta titles and
 * descriptions, collection blurbs. Editing a default in the source changes
 * NOTHING there, because seedSiteContent.js only ever creates missing keys.
 *
 * That is precisely how ADR 0008 came to be decided in June, implemented in
 * June, and still visibly untrue on the website in August: the decision landed
 * in the code and never in the database.
 *
 * Reports, never writes. Origin is a regulated claim and a wrong one is worse
 * than a blank, so a human decides each replacement — the same discipline as
 * renameProducts.js and refileCategories.js.
 *
 *   node scripts/auditCopyClaims.js
 *
 * See ADR 0008 in decisions.md and utils/originClaims.js for the rule.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { findOriginClaims } = require('../utils/originClaims');

// Every store that holds customer-facing prose, and which fields in it. Miss
// one and the claim survives in the surface nobody thought to look at — the
// stored SEO meta was exactly that surface, still asserting Donegal months
// after the visible copy was corrected.
const SURFACES = [
  { model: 'SiteContent', path: '../models/SiteContent', label: 'key', fields: ['value'] },
  { model: 'Product', path: '../models/Product', label: 'name', fields: ['description', 'metaTitle', 'metaDescription', 'keywords', 'origin', 'materialComposition'] },
  { model: 'Collection', path: '../models/Collection', label: 'name', fields: ['description', 'metaTitle', 'metaDescription'] },
  { model: 'Category', path: '../models/Category', label: 'label', fields: ['description', 'metaTitle', 'metaDescription'] },
  { model: 'JournalArticle', path: '../models/JournalArticle', label: 'title', fields: ['excerpt', 'body', 'metaTitle', 'metaDescription', 'keywords'] },
];

async function run() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected. Scanning live copy for forbidden origin claims…\n');

  let total = 0;
  const bySurface = [];

  for (const surface of SURFACES) {
    let Model;
    try {
      Model = require(surface.path);
    } catch {
      // A model that has been renamed should not take the whole audit down —
      // the other surfaces still need reporting.
      console.log(`  [skipped]   ${surface.model} — model not found at ${surface.path}`);
      continue;
    }

    const docs = await Model.find({}).lean().catch(err => {
      console.log(`  [error]     ${surface.model} — ${err.message}`);
      return [];
    });

    const hits = [];
    for (const doc of docs) {
      for (const field of surface.fields) {
        const raw = doc[field];
        // `keywords` is an array on some models; join so one scan covers both.
        const text = Array.isArray(raw) ? raw.join(', ') : raw;
        for (const claim of findOriginClaims(text)) {
          hits.push({
            id: String(doc._id),
            label: doc[surface.label] || '(unnamed)',
            field,
            match: claim.match,
            why: claim.why,
            snippet: String(text).replace(/\s+/g, ' ').slice(0, 140),
          });
        }
      }
    }

    total += hits.length;
    bySurface.push({ surface: surface.model, hits });
  }

  for (const { surface, hits } of bySurface) {
    console.log(`\n── ${surface} — ${hits.length} claim${hits.length === 1 ? '' : 's'} ──`);
    if (!hits.length) { console.log('   clean'); continue; }
    for (const h of hits) {
      console.log(`\n   ${h.label}  ·  ${h.field}`);
      console.log(`   _id: ${h.id}`);
      console.log(`   claim: "${h.match}" — ${h.why}`);
      console.log(`   text:  ${h.snippet}${h.snippet.length >= 140 ? '…' : ''}`);
    }
  }

  console.log(`\n\nTotal: ${total} forbidden claim${total === 1 ? '' : 's'} in live copy.`);
  if (total) {
    console.log('\nNothing was changed. Each of these is a sentence a human has to rewrite —');
    console.log('a wrong origin is worse than no origin, so none of it is safe to automate.');
    console.log('Product meta (metaTitle/metaDescription/keywords) can instead be REGENERATED');
    console.log('from admin: the AI prompts are already origin-neutral, so a fresh generation');
    console.log('will not reintroduce the claim.');
  }

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
