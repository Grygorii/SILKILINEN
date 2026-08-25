'use strict';

// Origin claims — the ONE rule for what SILKILINEN may say about where things
// are made. See ADR 0008 in decisions.md.
//
// Origin is a REGULATED consumer claim, and this shop's origin is mixed: some
// pieces are made by hand in Donegal, others are manufactured in China, India
// or Egypt. So a blanket "Made in Ireland" is not merely off-brand, it is a
// false statement about a regulated attribute, printed on a page that sells.
//
// The decision to stop making those claims was taken in June 2026 and the code
// was corrected then. It came back anyway — `seed.js` still described five
// products as "Made in Ireland", `fixBridalEdit.js` wrote it into a collection
// description afterwards, and the About page still said "We produce in small
// runs". A rule written only in prose is a rule that decays, which is what this
// file exists to stop.
//
// The distinction that makes the rule workable: WHERE THE BRAND IS is always
// true and always sayable; WHERE A PRODUCT IS MADE is per-item, verified, and
// lives in `Product.origin`. "An Irish silk & linen brand, based in Donegal" is
// correct. "Irish silk" is not.

// Phrases that are TRUE and are meant to be used. They are removed from the
// text BEFORE the banned patterns run, for two reasons.
//
// One: without it, "an Irish silk & linen brand" trips the "Irish silk" rule,
// and a guard that cries wolf on the one sentence the brand is supposed to use
// gets switched off rather than fixed.
//
// Two, and more important: this list is the POSITIVE half of the rule. The ban
// is on the idea that the range is MANUFACTURED in Ireland — not on the words
// Ireland or Donegal, which describe things that are simply true. SILKILINEN is
// Irish-founded, Sabreena designs the pieces in Donegal, and orders ship from
// Ireland; all three stay sayable however the making is sourced. Several of
// these would pass anyway by matching no ban, but passing by accident is not
// the same as being allowed: listed here, they cannot be caught by a later
// tightening of the manufacture patterns, and the list doubles as the answer to
// "what CAN we say?".
//
// The line runs between DESIGN and MAKING. "Designed in Donegal" is allowed;
// add "and crafted" and it becomes a manufacture claim about a mixed-origin
// range, which is the thing ADR 0008 forbids.
const ALLOWED = [
  // Where the brand is from
  /an?\s+irish\s+silk\s*(?:&|and)\s*linen\s+brand/gi,
  /\ban\s+irish\s+brand\b/gi,
  // "house", "label", "brand" name the BUSINESS, not the fibre — an Irish
  // silk house is an Irish company that works in silk, which is exactly what
  // this one is. Only "Irish silk" attached to the PRODUCT is the claim.
  /an?\s+(?:independent\s+)?irish\s+(?:silk|linen)(?:\s*(?:&|and)\s*(?:silk|linen))?\s+(?:house|brand|label)/gi,
  /\birish[-\s]founded\b/gi,
  /\bbased\s+in\s+donegal\b/gi,
  /\bborn\s+in\s+donegal\b/gi,
  /\bfounded\s+in\s+(?:ireland|donegal)\b/gi,
  // Where the design happens — verified: Sabreena designs in Donegal, and that
  // remains true of a piece manufactured abroad. brand.md called this
  // "unverified" until the founders confirmed it in August 2026.
  /\bdesigned\s+in\s+(?:ireland|donegal)\b/gi,
  /\beuropean\s+design\b/gi,
  // Where it ships from
  /\bship(?:s|ped|ping)?\s+from\s+(?:donegal|ireland)\b/gi,
];

// Each pattern names the claim it forbids and why, because the message is what
// the founder actually reads when the guard fires.
const BANNED = [
  {
    id: 'made-in',
    re: /\b(?:made|produced|manufactured|assembled)\s+in\s+(?:ireland|donegal|dublin|the\s+republic)/i,
    why: 'States a country of manufacture for the whole range. Origin is mixed and per-product — put the verified value in Product.origin instead.',
  },
  {
    id: 'crafted-in',
    re: /\b(?:crafted|cut|sewn|stitched|woven|finished|designed\s+and\s+crafted)\s+in\s+(?:ireland|donegal|dublin)/i,
    why: 'A manufacture claim in softer words. ADR 0008 forbids swapping one blanket claim for a gentler one that is equally unverified.',
  },
  {
    id: 'handmade',
    re: /\bhand[-\s]?(?:made|crafted|finished|sewn|stitched)\b/i,
    why: 'Claims how every piece is produced. True of some Donegal pieces, not of the imported range.',
  },
  {
    id: 'irish-product',
    re: /\birish\s+(?:craftsmanship|linen|silk|made|manufacture)/i,
    why: 'Attaches Irishness to the PRODUCT rather than the brand. "An Irish silk & linen brand, based in Donegal" is the sayable version.',
  },
  {
    id: 'our-production',
    // The noun matters: "We make every effort to display colours accurately"
    // is a returns disclaimer, not a claim about a factory. An earlier draft
    // of this pattern flagged it, which is the kind of false positive that
    // gets a guard deleted rather than fixed.
    re: /\b(?:we|our)\s+(?:produce|manufacture)\b|\bwe\s+(?:make|sew|cut)\s+(?:each|every|our|them|these)\s+(?:piece|garment|item|product|robe|scarf)/i,
    why: 'Asserts SILKILINEN does the manufacturing. It does not, for most of the range.',
  },
  {
    id: 'small-batch',
    // Hyphenated is the commoner form in marketing copy — "small-batch
    // production" — and an earlier version of this pattern allowed only
    // whitespace, so the phrase walked past the guard on its first real test.
    re: /\bsmall[-\s]+(?:batch|batches|runs?)\b/i,
    why: 'A production claim we cannot keep across suppliers. "Small, considered collections" says the true thing — we control the range, not the factory.',
  },
];

/**
 * Strip line and block comments. A comment cannot reach a customer, so it is
 * not copy — and the files most likely to mention a banned claim in passing are
 * the ones whose job is removing it (the migration documenting what it
 * replaced, this rule explaining itself). Scanning those as if they were
 * storefront text makes the guard unusable, and an unusable guard gets deleted.
 */
function stripComments(text) {
  return String(text)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

/**
 * Find every banned origin claim in a piece of copy.
 *
 * @param {string} text
 * @param {{code?: boolean}} [opts] `code: true` strips comments first — for
 *        scanning source files rather than a single stored string
 * @returns {{id: string, match: string, why: string}[]} empty when clean
 */
function findOriginClaims(text, opts = {}) {
  if (!text) return [];
  if (opts.code) text = stripComments(text);
  // Blank out what is legitimately sayable, keeping the length stable so
  // nothing downstream depends on offsets shifting.
  let scrubbed = String(text);
  for (const re of ALLOWED) scrubbed = scrubbed.replace(re, m => ' '.repeat(m.length));

  const found = [];
  for (const { id, re, why } of BANNED) {
    const m = scrubbed.match(re);
    if (m) found.push({ id, match: m[0].trim(), why });
  }
  return found;
}

/** True when the copy makes no forbidden origin claim. */
function isOriginSafe(text) {
  return findOriginClaims(text).length === 0;
}

module.exports = { findOriginClaims, isOriginSafe, stripComments, BANNED, ALLOWED };
