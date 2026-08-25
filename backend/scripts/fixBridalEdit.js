'use strict';

// Repair the Bridal Edit collection: the typo in its name, and the
// keyword-stuffed sentence sitting under it as body copy.
//
// Live on the homepage right now, under a heading that says "Collections":
//
//   The Bridal Edite
//   A curated edit of silk robe, nightshirt, pajamas, eye mask, slip dress
//   made in Ireland from pure silk
//
// That string is also what became the URL slug. It reads as SEO filler in the
// one section of the page meant to feel curated, and "Edite" is simply wrong.
//
// The slug is re-cut too, and Collection.pre('save') moves the old one into
// previousSlugs — /api/collections/:slug falls back to it and the storefront
// permanentRedirects to canonical, so the old link 301s rather than 404ing.
//
//   node scripts/fixBridalEdit.js           # show what would change
//   node scripts/fixBridalEdit.js --apply

require('dotenv').config();
const mongoose = require('mongoose');
const Collection = require('../models/Collection');

const APPLY = process.argv.includes('--apply');

const NAME = 'The Bridal Edit';
// One human sentence. Says what it is and who it is for, and stops.
// No origin claim: this script writes straight into the live Collection, and
// the sentence it replaced asserted "made in Ireland" for a set drawn from a
// mixed-origin range (ADR 0008). Guarded now by tests/originClaims.test.js.
const DESCRIPTION = 'Silk for the morning of — robes, slips and eye masks, chosen to photograph as softly as they wear.';

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(process.env.MONGODB_URI);

  // Match on the typo, and fall back to anything bridal, so this still works if
  // the name was corrected by hand in the admin first.
  const c = await Collection.findOne({ $or: [{ name: /edite/i }, { name: /bridal/i }] });
  if (!c) {
    console.log('No bridal collection found — nothing to do.');
    await mongoose.disconnect();
    return;
  }

  console.log('name:');
  console.log(`  from: ${c.name}`);
  console.log(`  to:   ${NAME}`);
  console.log('description:');
  console.log(`  from: ${(c.description || '(empty)').slice(0, 100)}`);
  console.log(`  to:   ${DESCRIPTION}`);
  console.log('slug:');
  console.log(`  from: /collections/${c.slug}`);
  console.log('  to:   /collections/the-bridal-edit');

  if (!APPLY) {
    console.log('\nDry run — nothing written. Re-run with --apply.');
    await mongoose.disconnect();
    return;
  }

  c.name = NAME;
  c.description = DESCRIPTION;
  // Set explicitly: pre('save') only derives a slug when it is empty, so the
  // sentence-slug would otherwise survive the rename.
  c.slug = 'the-bridal-edit';
  await c.save();

  console.log(`\nSaved. Now /collections/${c.slug}`);
  console.log(`Old URL 301s via previousSlugs: ${c.previousSlugs.join(', ') || 'none recorded'}`);
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
