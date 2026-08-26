// How a shop listing may be ordered — the ONE whitelist.
//
// The route used to hold a single line, `if (sort === '-createdAt')`, so every
// other value silently fell through to Mongo's natural order. That is not a
// neutral default: natural order is insertion order, which means "sort by
// price" would have quietly returned the same arbitrary sequence as no sort at
// all, and looked like it worked.
//
// A whitelist rather than passing the query through: `sort` reaches Mongo's
// sort specification, and an attacker-supplied key can be used to probe or
// order on fields the projection never returns. Unknown values fall back to
// the default rather than erroring — a shopper who edits the URL should get
// the shop, not a 400.
//
// Values are the strings that appear in the URL, so they are part of the
// public interface: renaming one breaks any link a customer has shared.
const SORTS = {
  featured: null,                                   // the shop's own order
  newest: { createdAt: -1 },
  'price-asc': { price: 1 },
  'price-desc': { price: -1 },
  // Kept because the storefront has used it in links since before the
  // whitelist existed; same meaning as `newest`.
  '-createdAt': { createdAt: -1 },
};

const DEFAULT_SORT = 'featured';

/** Mongo sort spec for a URL value, or null for the collection's own order. */
function sortSpec(value) {
  const key = String(value || '').trim();
  return Object.prototype.hasOwnProperty.call(SORTS, key) ? SORTS[key] : SORTS[DEFAULT_SORT];
}

/** The value a UI should treat as active — unknown input reads as the default. */
function sortKey(value) {
  const key = String(value || '').trim();
  return Object.prototype.hasOwnProperty.call(SORTS, key) ? key : DEFAULT_SORT;
}

module.exports = { SORTS, DEFAULT_SORT, sortSpec, sortKey };
