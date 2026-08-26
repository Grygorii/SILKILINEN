// How many of a piece a customer may put in the bag.
//
// The stepper capped at `Math.min(stock ?? 10, 10)`, where `stock` is the
// product's TOTAL across every size. So a robe with ten in stock — nine of
// them Large, one Medium — let someone order five Mediums.
//
// That matters more here than it would in most shops, because nothing
// downstream catches it. checkoutV2 does not check availability before taking
// the payment; it decrements stock AFTER the order commits, deliberately
// fail-soft so a stock write can never lose a paid order. The cap in the
// stepper is therefore not a convenience, it is the only thing standing
// between the customer and an order the shop cannot fill.
//
// Deliberately conservative in the other direction too: when a piece has no
// variant rows at all, stock is UNTRACKED for it, which is not the same as
// sold out. Those keep the old behaviour rather than being clamped to zero.

/** Shape of a Product.variants row, as served to the storefront. */
export type VariantLike = { size?: string | null; stockLevel?: number | null };

/** The most of anything one order may contain, whatever the stock says. */
export const ORDER_CAP = 10;

/**
 * size → units in stock. Sizes are summed rather than overwritten: a record
 * may carry one row per size AND colour, and this page is already scoped to a
 * single colour product.
 */
export function stockBySize(variants?: VariantLike[] | null): Record<string, number> {
  const map: Record<string, number> = {};
  if (!Array.isArray(variants)) return map;
  for (const v of variants) {
    const size = String(v?.size ?? '').trim();
    if (!size) continue;
    const n = Number(v?.stockLevel);
    map[size] = (map[size] ?? 0) + (Number.isFinite(n) && n > 0 ? n : 0);
  }
  return map;
}

/**
 * The stepper's ceiling.
 *
 * `bySize` empty means the piece has no variant tracking — fall back to the
 * total. A size that is selected AND tracked uses its own figure. A size
 * selected but missing from the map is sold out, and returns 0 so the caller
 * can say so rather than offering one.
 */
export function maxOrderable(
  bySize: Record<string, number>,
  selectedSize: string | null | undefined,
  totalStock?: number | null,
): number {
  const total = Number.isFinite(Number(totalStock)) && Number(totalStock) > 0
    ? Number(totalStock)
    : ORDER_CAP;

  const tracked = Object.keys(bySize).length > 0;
  if (!tracked) return Math.min(total, ORDER_CAP);

  const size = String(selectedSize ?? '').trim();
  // Nothing chosen yet on a multi-size piece: the largest any size could allow,
  // not the sum of all of them. Clamped again the moment a size is picked.
  if (!size) return Math.min(Math.max(0, ...Object.values(bySize)), ORDER_CAP);

  return Math.min(bySize[size] ?? 0, ORDER_CAP);
}
