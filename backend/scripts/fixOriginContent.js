/**
 * One-off: correct the blanket "Donegal/Ireland-made" claims in the LIVE
 * SiteContent collection.
 *
 * seedSiteContent.js only CREATES missing keys; it skips ones that already
 * exist, so it can't fix copy that's already in the database. This script
 * force-updates the specific keys whose seeded values asserted a false
 * blanket origin, replacing them with the honest brand-level line.
 *
 * Origin is mixed across the range and SILKILINEN is an Irish brand based in
 * Donegal — these values say exactly that and never imply Irish-made.
 *
 * Idempotent: only writes when the stored value differs. Safe to re-run.
 *   node backend/scripts/fixOriginContent.js
 *
 * See ADR 0008 in decisions.md.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const SiteContent = require('../models/SiteContent');

// Honest replacements, keyed by SiteContent.key. Mirrors the corrected
// defaults in seedSiteContent.js so seed and live stay in sync.
const FIXES = {
  banner_message_3: 'An Irish silk & linen brand, based in Donegal',
  homepage_hero_subtitle: 'Pure silk & linen intimates',
  homepage_story_title: 'Born in Donegal, worn across the world',
  homepage_story_text:
    'SILKILINEN began with a simple belief: that the garments closest to your skin should be made from the finest natural fibres. We source Mulberry silk and European linen — chosen for their breathability, longevity, and the quiet luxury they bring to everyday moments.\n\nWe\'re an Irish brand based in Donegal, and every piece is made by skilled artisans who share our commitment to slow, considered making.',
  about_story_text:
    'SILKILINEN began with a simple belief: that the garments closest to your skin should be made from the finest natural fibres.\n\nWe source Mulberry silk and European linen — chosen for their breathability, longevity, and the quiet luxury they bring to everyday moments.\n\nWe\'re an Irish brand based in Donegal, and every piece is made by skilled artisans who share our commitment to slow, considered making. We work in small batches, never rushing the process, so that what reaches you is exactly what we intended — something you\'ll reach for again and again.',
};

async function run() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');

  let updated = 0, unchanged = 0, missing = 0;
  for (const [key, value] of Object.entries(FIXES)) {
    const doc = await SiteContent.findOne({ key });
    if (!doc) {
      console.log(`  [missing]   ${key} — not in DB (seed will create the corrected value)`);
      missing++;
      continue;
    }
    if (doc.value === value) {
      console.log(`  [ok]        ${key} — already correct`);
      unchanged++;
      continue;
    }
    console.log(`  [updating]  ${key}`);
    console.log(`      was: ${JSON.stringify(doc.value).slice(0, 90)}…`);
    doc.value = value;
    await doc.save();
    updated++;
  }

  console.log(`\nDone — ${updated} updated, ${unchanged} already correct, ${missing} missing.`);
  console.log('NOTE: any admin-edited overrides of these keys are replaced. Re-edit in admin if needed.');
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
