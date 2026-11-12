'use strict';

// Curated existing catalogue siblings. Stored admin links always take precedence.
// This fallback adds navigation only; it never merges products, stock or prices.
const BOXER_COLOURS = [
  'silk-boxer-short-bare-in-champagne',
  'silk-men-s-pure-boxer-shorts-in-copper',
  'silk-boxer-shorts-in-sky-blue',
];
function fallbackColourSlugs(product) {
  if (product.colorVariants?.length || !BOXER_COLOURS.includes(product.slug)) return [];
  return BOXER_COLOURS.filter(slug => slug !== product.slug);
}
module.exports = { fallbackColourSlugs, BOXER_COLOURS };
