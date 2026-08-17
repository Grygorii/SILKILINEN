'use strict';

// THE rule for which category a garment belongs in. One owner, because the
// category is repeated in three customer-facing places — the breadcrumb, the
// /shop?category= filter and g:product_type in the Shopping feed — so one wrong
// value is wrong three times, confidently, and nothing surfaces it.
//
// Deliberately conservative. A false flag sends the founder to "fix" something
// already correct, which is worse than staying quiet: it teaches them to ignore
// the advisor. So the rule says nothing about a garment it has no entry for, a
// garment that legitimately belongs to two categories, or a product with no
// category at all.
//
// Only usable because names now follow one shape (utils/productName.js:
// "Silk [garment] in [Colour]") — the garment word is reliably in the name.

// Garment word -> the categories it can defensibly sit in. Match on the live
// consolidated slugs (see scripts/consolidateCategories.js), not the nine
// pre-merge ones still listed in config/categories.js.
//
// Ambiguous garment words are deliberately ABSENT rather than mapped: "shirt"
// and "shorts" name both a lounge piece and a pyjama piece, so no entry can be
// right for both and the rule declines to have an opinion.
const GARMENT_CATEGORY = {
  nightshirt: ['sleepwear'],
  pyjama: ['sleepwear'],
  'slip dress': ['sleepwear', 'lingerie'],
  robe: ['robes'],
  kimono: ['robes'],
  brief: ['lingerie'],
  knicker: ['lingerie'],
  bikini: ['lingerie'],
  pillowcase: ['home'],
  eyemask: ['home'],
  'eye mask': ['home'],
  scarf: ['scarves'],
};

/**
 * Is this product filed under the wrong category?
 *
 * @param {string} name      product name — the garment word is read from it
 * @param {string} category  the slug currently on Product.category
 * @param {string[]} [knownSlugs] the category slugs that exist in the shop right
 *   now. Pass them and the rule will never advise moving a product into a
 *   category that doesn't exist — the catalogue has been re-categorised once
 *   already (nine slugs merged into six), so the table above can fall behind
 *   the database, and "move it to sleepwear" is useless advice if there is no
 *   sleepwear any more. Omit to check the table alone.
 * @returns {{garment: string, expected: string[]}|null} null when there is
 *   nothing to say — which is most of the time, by design.
 */
function misfiledCategory(name, category, knownSlugs = null) {
  const n = String(name || '').toLowerCase();
  const current = String(category || '').toLowerCase();

  // No category is not a wrong category. Product.category defaults to a slug,
  // so this is rare, but guessing here would flag a product whose real problem
  // is something else entirely.
  if (!current) return null;

  const hit = Object.entries(GARMENT_CATEGORY).find(([word]) => n.includes(word));
  if (!hit) return null;

  const [garment, allowed] = hit;
  if (allowed.includes(current)) return null;

  const expected = knownSlugs ? allowed.filter(s => knownSlugs.includes(s)) : allowed;
  if (!expected.length) return null;

  return { garment, expected };
}

module.exports = { misfiledCategory, GARMENT_CATEGORY };
