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

// Match an order line to a variant by colour+size; fall back to the sole
// variant when a product has exactly one (common for size-only or one-variant
// products). Returns null when the variant can't be identified unambiguously.
function matchVariant(variants, colour = '', size = '') {
  let v = variants.find(x => (x.colour || '') === (colour || '') && (x.size || '') === (size || ''));
  if (!v && variants.length === 1) v = variants[0];
  return v || null;
}

// Returns a customer-facing error string if the line can't be fulfilled, else
// null. `product` may be a lean object. Used at create-intent.
function availabilityError(product, { colour = '', size = '', quantity = 1 } = {}) {
  if (product.status === 'sold_out') return `"${product.name}" is sold out`;
  const variants = product.variants || [];
  if (variants.length > 0) {
    const v = matchVariant(variants, colour, size);
    if (v && (v.stockLevel || 0) < quantity) {
      const left = v.stockLevel || 0;
      const which = size ? ` (${size})` : '';
      return left === 0
        ? `"${product.name}"${which} is out of stock`
        : `Only ${left} of "${product.name}"${which} left`;
    }
  }
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

module.exports = { availabilityError, decrementStockForOrder };
