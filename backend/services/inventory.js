'use strict';

// Inventory — availability checks at checkout and stock decrement on sale.
//
// Stock is tracked on Product.variants[].stockLevel (totalStock is derived in
// the Product pre-save hook). Before this, stock only ever changed via admin
// edits, so the store could oversell and keep selling `sold_out` items.
//
// Philosophy: only decrement products that ACTUALLY track stock (have variants,
// or a positive totalStock). Variantless, untracked products are left alone so
// loosely-managed lines aren't forced to zero. Never throws on oversell —
// payment is already captured by the time we get here — it clamps at zero and
// logs, so an order is never lost to a stock hiccup.

const Product = require('../models/Product');

// Match an order line to a variant, most specific first. Returns null when the
// line can't be pinned to exactly one variant.
//
// The colour-blind tier matters more than it looks. Colour is per-PRODUCT in
// this shop — siblings are separate products — so a variant row usually carries
// the same colour on every size, and an order line may or may not repeat it
// depending on how the cart was built and when. Matching only on colour+size
// meant a line with no colour missed every row, and an unmatched line used to
// skip the stock check entirely.
function matchVariant(variants, colour = '', size = '') {
  const c = colour || '';
  const z = size || '';

  // 1. Exact.
  let v = variants.find(x => (x.colour || '') === c && (x.size || '') === z);
  if (v) return v;

  // 2. Size alone, when that identifies one row. Covers a line whose colour is
  //    missing or stale against a product whose rows all share one colour.
  if (z) {
    const bySize = variants.filter(x => (x.size || '') === z);
    if (bySize.length === 1) return bySize[0];
  }

  // 3. Colour alone, for size-less pieces (scarves, eye masks) tracked by colour.
  if (c && !z) {
    const byColour = variants.filter(x => (x.colour || '') === c);
    if (byColour.length === 1) return byColour[0];
  }

  // 4. The only row there is.
  if (variants.length === 1) return variants[0];

  return null;
}

/**
 * Units this product has, across every variant — or null when it doesn't track
 * stock at all.
 *
 * Untracked is not the same as sold out. Per this module's philosophy, a
 * loosely-managed line with no variants and no totalStock stays buyable rather
 * than being forced to zero.
 */
function trackedTotal(product) {
  const variants = product.variants || [];
  if (variants.length > 0) {
    return variants.reduce((n, v) => n + Math.max(0, Number(v.stockLevel) || 0), 0);
  }
  const total = Number(product.totalStock);
  return Number.isFinite(total) && total > 0 ? total : null;
}

// Returns a customer-facing error string if the line can't be fulfilled, else
// null. `product` may be a lean object. Used at create-intent.
function availabilityError(product, { colour = '', size = '', quantity = 1 } = {}) {
  if (product.status === 'sold_out') return `"${product.name}" is sold out`;

  const variants = product.variants || [];
  const which = size ? ` (${size})` : '';
  const short = (left) => (left === 0
    ? `"${product.name}"${which} is out of stock`
    : `Only ${left} of "${product.name}"${which} left`);

  const v = variants.length > 0 ? matchVariant(variants, colour, size) : null;
  if (v) {
    const left = Math.max(0, Number(v.stockLevel) || 0);
    return left < quantity ? short(left) : null;
  }

  // A size was asked for and no row carries it. This is the one case worth
  // refusing outright: the piece does not come in it, so no quantity is
  // fulfillable. Reached by a cart left open across a size being renamed or
  // withdrawn, and by anything hand-built.
  if (size && variants.length > 0 && !variants.some(x => (x.size || '') === size)) {
    return `"${product.name}" is no longer available in ${size}`;
  }

  // Otherwise the line could not be pinned to a variant. Refuse only what can
  // be PROVEN unfillable — the whole product's stock — and stay silent when it
  // can't be. A guard that blocks a legitimate order is worse than the oversell
  // it was added to prevent.
  const total = trackedTotal(product);
  if (total !== null && total < quantity) return short(total);

  return null;
}

// Decrement stock for a paid order's items. Call this AFTER the order has been
// committed (not inside the order transaction) so neither a Stripe webhook
// retry nor a Mongo transaction retry can double-decrement — the webhook's
// duplicate-order guard already makes the whole flow run once per order.
async function decrementStockForOrder(items) {
  // Flatten to product lines; bundle children inherit the bundle line quantity.
  const lines = [];
  for (const it of items || []) {
    const qty = Math.max(1, parseInt(it.quantity, 10) || 1);
    if (it.bundleId) {
      for (const c of it.includedProducts || []) {
        if (c.productId) lines.push({ productId: c.productId, colour: '', size: '', units: qty * (c.quantity || 1) });
      }
    } else if (it.productId) {
      lines.push({ productId: it.productId, colour: it.colour || '', size: it.size || '', units: qty });
    }
  }

  for (const line of lines) {
    try {
      const product = await Product.findById(line.productId);
      if (!product) continue;

      // Atomic decrement via $inc so two concurrent orders on the same last
      // unit each apply their own -units, instead of both computing from a stale
      // in-memory read and the second save() silently overwriting the first
      // (lost update → silent oversell). We then reload and save() so the
      // pre-save hook still recomputes totalStock/inStock and flips status to
      // sold_out; validateBeforeSave:false keeps a legacy doc that violates a
      // later-added validator from throwing and skipping the recompute.
      if (product.variants && product.variants.length > 0) {
        const v = matchVariant(product.variants, line.colour, line.size);
        if (!v) continue; // can't identify the variant — leave stock untouched
        await Product.updateOne(
          { _id: product._id, 'variants._id': v._id },
          { $inc: { 'variants.$.stockLevel': -line.units } }
        );
        const fresh = await Product.findById(product._id);
        if (!fresh) continue;
        const fv = fresh.variants.id(v._id);
        if (fv && fv.stockLevel < 0) {
          console.warn(`[inventory] oversold product ${fresh._id} (${fv.sku || fv._id}): ${fv.stockLevel + line.units} in stock, sold ${line.units}`);
          fv.stockLevel = 0; // clamp the oversell; $inc bypasses the min:0 validator
        }
        await fresh.save({ validateBeforeSave: false });
      } else if (typeof product.totalStock === 'number' && product.totalStock > 0) {
        await Product.updateOne(
          { _id: product._id },
          { $inc: { totalStock: -line.units } }
        );
        const fresh = await Product.findById(product._id);
        if (!fresh) continue;
        if (typeof fresh.totalStock === 'number' && fresh.totalStock < 0) {
          console.warn(`[inventory] oversold product ${fresh._id}: ${fresh.totalStock + line.units} in stock, sold ${line.units}`);
          fresh.totalStock = 0;
        }
        await fresh.save({ validateBeforeSave: false });
      } else {
        continue; // untracked — nothing to decrement
      }
    } catch (err) {
      console.error('[inventory] decrement failed for', String(line.productId), err.message);
    }
  }
}

/**
 * A checker that remembers what the rest of the basket has already claimed.
 *
 * availabilityError judges ONE line. Two lines of the same size — 1 + 1 against
 * a stock of 1 — each passed on their own and oversold together. The cart UI
 * merges identical lines, but checkout also accepts `items` straight from the
 * client, so a stale or hand-built payload never went through that merge.
 *
 * Lives here rather than in the route because it is the rule, not the plumbing:
 * the route reaches Mongo, this does not, and a rule that cannot be tested
 * without a database tends not to be tested.
 *
 * Usage: one checker per priced order. Call for every line, including bundle
 * children — they draw on the same stock. Returns an error string, or null and
 * records the units.
 *
 *   const check = basketChecker();
 *   const err = check(product, { colour, size, quantity });
 */
function basketChecker() {
  const claimed = new Map();

  return function check(product, { colour = '', size = '', quantity = 1 } = {}) {
    const variants = product.variants || [];
    const v = variants.length ? matchVariant(variants, colour, size) : null;
    // Keyed on the RESOLVED variant, not the line's text: {colour:'Sky Blue',
    // size:'M'} and {colour:'', size:'M'} are different lines describing the
    // same garment, and a text key would let that pair through.
    const key = `${product._id}|${v ? v._id : `${colour || ''}~${size || ''}`}`;

    const total = (claimed.get(key) || 0) + quantity;
    const err = availabilityError(product, { colour, size, quantity: total });
    if (err) return err;

    claimed.set(key, total);
    return null;
  };
}

module.exports = { availabilityError, decrementStockForOrder, matchVariant, trackedTotal, basketChecker };
