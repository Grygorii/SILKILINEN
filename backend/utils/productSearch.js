'use strict';

// THE product search rule. One owner, because tests/productSearch.test.js used
// to mirror a copy of it — and a mirrored search filter is a filter nobody is
// really testing.
//
// The fields are the ones a shopper actually types: not just name and
// description, but colour, size, category and cloth. "sky blue", "pyjamas",
// "linen" and "medium" were all real queries that returned an empty page while
// the product sat in the catalogue — a naming mismatch reported as a gap in the
// range.
const SEARCH_FIELDS = ['name', 'description', 'category', 'colours', 'colorName', 'sizes', 'materialComposition'];

// Escape before it reaches Mongo. A query value can arrive as an object
// ({$ne:''}) or as a regex-special string, and escaping stops both operator
// injection and a ReDoS crafted against the unindexed description field.
function escapeTerm(term) {
  return String(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function orAcrossFields(word) {
  const safe = escapeTerm(word);
  return SEARCH_FIELDS.map(f => ({ [f]: { $regex: safe, $options: 'i' } }));
}

/**
 * Mongo filter fragment for a search query, or null when there is nothing to
 * search for (empty or whitespace-only — Mongo rejects an empty $and, and a
 * blank query should return the whole shop rather than an error).
 *
 * EVERY WORD MUST MATCH, but each may match a DIFFERENT field. This is the fix
 * for the shape of miss that produced most of the zero-result searches: the
 * filter used to regex the whole phrase against each field in turn, so "sky blue
 * robe" found nothing — no single field contains that string — even though the
 * shop sells exactly that, with "robe" in the name and "Sky Blue" in colorName.
 * The empty page then arrived in the advisor as unmet demand, recommending we
 * stock a product we already had.
 *
 * A single word behaves exactly as before, so the common case is unchanged.
 */
function buildSearchFilter(q) {
  const words = String(q ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  if (words.length === 1) return { $or: orAcrossFields(words[0]) };
  return { $and: words.map(w => ({ $or: orAcrossFields(w) })) };
}

module.exports = { buildSearchFilter, SEARCH_FIELDS, escapeTerm };
