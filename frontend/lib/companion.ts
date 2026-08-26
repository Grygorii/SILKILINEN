// What completes the look — the pairing rule behind "Shop the look".
//
// This is NOT the same question as "related products", and conflating them is
// why the PDP's existing grid cannot do this job. `/api/products/related/:id`
// returns pieces LIKE the one being viewed: another robe under a robe. Those
// are alternatives — the customer is choosing between them, and showing two at
// once asks them to choose again. A look is the opposite: a second piece that
// only makes sense ALONGSIDE the first.
//
// So the rule is per-category and deliberately one-directional. A robe pairs
// with an eye mask; an eye mask does not pair back with a robe, because someone
// buying a €49 accessory is not one click from adding a €168 garment, and
// pretending otherwise makes the module feel like an upsell rather than a
// suggestion.
//
// ── What this is not allowed to claim ──
//
// "Frequently bought together" and "customers also bought" are statements about
// order history. This shop has almost none, so those phrases would be invented
// social proof — the same failure as an invented momme, in a place a customer
// is more likely to believe it. The module says "Pairs with", which is an
// editorial recommendation and honestly ours to make.

/** Canonical category slugs (backend/config/categories.js). */
const COMPANION: Record<string, string> = {
  // A robe is worn over something and taken off at the bedside — the accessory
  // categories complete it.
  robes: 'home',
  sleepwear: 'home',
  lounge: 'home',
  // Lingerie is the layer under a robe, and the robe is the higher-value piece
  // someone shopping lingerie plausibly still needs.
  lingerie: 'robes',
};

// Deliberately absent, and each for a reason rather than by oversight:
//
//   home     — the accessories. Pairing back up to a garment turns a €49
//              purchase into a €168 suggestion, which reads as pressure.
//   scarves  — a daywear piece with no natural partner in a sleep-and-lounge
//              range. Any pairing here would be invented to fill the slot.
//
// A category with no entry renders no module. An empty space is honest; a
// forced pairing is the kind of thing that makes a considered shop feel like a
// funnel.

/**
 * The category that completes a look for this one, or null when there isn't a
 * pairing worth making.
 */
export function companionCategory(category?: string | null): string | null {
  const key = String(category || '').trim().toLowerCase();
  return COMPANION[key] ?? null;
}

/**
 * Should these two pieces be shown as a look?
 *
 * Separate from the category rule because the category can be right while the
 * pairing is still wrong — most obviously a product paired with itself, which
 * happens whenever a garment is filed in its own companion category.
 */
export function canPairWith(
  product: { _id?: string; category?: string | null },
  candidate: { _id?: string; category?: string | null; inStock?: boolean; totalStock?: number },
): boolean {
  if (!product?._id || !candidate?._id) return false;
  if (String(product._id) === String(candidate._id)) return false;
  if (companionCategory(product.category) !== String(candidate.category || '').toLowerCase()) return false;
  // Never suggest adding something that cannot be bought. "Add both to bag"
  // that silently adds one is worse than not offering it.
  if (candidate.inStock === false || candidate.totalStock === 0) return false;
  return true;
}
