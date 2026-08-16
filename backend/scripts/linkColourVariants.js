'use strict';

// Link products that are the same garment in different colours.
//
// The PDP already renders sibling colours as swatches, and /api/products
// resolves each sibling's slug so the links stay canonical. The machinery was
// never fed: colorVariants is empty on every product, so a customer looking at
// "Silk bikini briefs in Bare Champagne" cannot see that the same brief exists
// in Black, Cream, Wine Red and Pink Blush. Five products, five dead ends.
//
// This was not practical before the rename. Names carried three word orders, so
// there was no reliable way to tell that two rows were the same garment. Now
// every name is "Silk [garment] in [Colour]", the grouping key is just the name
// with its colour removed — which is the quiet payoff of the naming work.
//
//   node scripts/linkColourVariants.js           # show the groups, change nothing
//   node scripts/linkColourVariants.js --apply

require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');

const APPLY = process.argv.includes('--apply');

// "Silk bikini briefs in Bare Champagne" -> "silk bikini briefs"
// Named pieces ("Silk satin scarf — The Grand Tour") have no colour suffix and
// group alone, which is correct: they are one-offs, not a colourway.
function groupKey(name) {
  return String(name || '')
    .replace(/\s+in\s+[^—]+$/i, '')
    .trim()
    .toLowerCase();
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(process.env.MONGODB_URI);

  const products = await Product.find({ status: { $in: ['active', 'sold_out'] } })
    .select('_id name colorName colours colorVariants')
    .lean();

  const groups = new Map();
  for (const p of products) {
    const key = groupKey(p.name);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }

  // A group of one is not a colourway — leave those alone entirely.
  const linkable = [...groups.entries()].filter(([, ps]) => ps.length > 1);

  if (!linkable.length) {
    console.log('No garment appears in more than one colour. Nothing to link.');
    await mongoose.disconnect();
    return;
  }

  console.log(APPLY ? '── LINKING ──\n' : '── PROPOSED (nothing written) ──\n');
  let updated = 0;

  for (const [key, ps] of linkable) {
    console.log(`${key} — ${ps.length} colours`);
    for (const p of ps) {
      // The colour label a sibling swatch will show. Prefer the explicit field;
      // fall back to what the name says after "in".
      const own = p.colorName
        || (p.colours || []).find(Boolean)
        || (String(p.name).match(/\s+in\s+(.+)$/i)?.[1] ?? '').trim();
      console.log(`   ${own || '(no colour)'} — ${p.name}`);
    }

    if (!APPLY) { console.log(''); continue; }

    for (const p of ps) {
      // Every OTHER product in the group, never itself.
      const siblings = ps
        .filter(s => String(s._id) !== String(p._id))
        .map(s => ({
          productId: s._id,
          colorName: s.colorName
            || (s.colours || []).find(Boolean)
            || (String(s.name).match(/\s+in\s+(.+)$/i)?.[1] ?? '').trim(),
        }))
        .filter(s => s.colorName);
      // updateOne, not save(): this touches nothing the pre('save') hook owns,
      // and re-slugging 27 products as a side effect of linking colours would
      // be a genuinely bad surprise.
      await Product.updateOne({ _id: p._id }, { $set: { colorVariants: siblings } });
      updated++;
    }
    console.log('');
  }

  console.log(`${linkable.length} colour group(s), ${updated} product(s) ${APPLY ? 'linked' : 'would be linked'}.`);
  if (!APPLY) console.log('\nRe-run with --apply to write.');
  else console.log('Each product now shows its other colourways as swatches on the PDP.');
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
