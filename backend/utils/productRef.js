'use strict';

// Resolve a product REFERENCE to the live product.
//
// Agents record which product a recommendation is about by NAME — Hermes is
// handed the live catalogue and told to use the exact product name as its
// entityRef. That reference is then stored in a GrowthAction and read back days
// or weeks later, by which time the name may have moved: scripts/renameProducts.js
// rewrote the whole catalogue to the "Silk [garment] in [Colour]" convention, and
// every plan written before it went stale in one pass. The panel could only say
// "couldn't match a product named …", which reads as a broken plan when the
// product is sitting right there under a new name.
//
// A name is a poor key. The fix has two halves: new plays record the id
// (services/growthAgents/hermes.js), and old refs are resolved through the rename
// trail here, so plans already in the database keep working.

const Product = require('../models/Product');
const { slugify } = require('./slug');

const FIELDS = 'name slug previousSlugs status totalStock inStock';

function escapeRx(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/**
 * @param {string} ref     the recorded product name (or slug)
 * @param {string} [id]    a recorded product id, if the play stored one
 * @param {object} [model] the Product model; injectable so the resolution ORDER can
 *   be tested without a database — the order is the whole behaviour here.
 * @returns {Promise<object|null>} the product, plus `matchedVia`:
 *   'id' | 'name' | 'slug' — how it was found, so a caller can say so.
 *
 * Deliberately does NOT guess. Every strategy below is an exact match on
 * something the product actually holds; nothing fuzzy, because the caller acts on
 * the result by rewriting that product's meta, and matching the WRONG product
 * silently edits the SEO of a page nobody asked about. An unresolved ref is a
 * question for a human, not a thing to approximate.
 */
async function findProductByRef(ref, id = null, model = Product) {
  // 1. The id, when the play recorded one. Immune to renaming, which is the
  //    whole point of storing it.
  if (id && /^[a-f0-9]{24}$/i.test(String(id))) {
    const p = await model.findById(id).select(FIELDS).lean().catch(() => null);
    if (p) return { ...p, matchedVia: 'id' };
  }

  const raw = String(ref || '').trim();
  if (!raw) return null;

  // 2. The name exactly as recorded.
  const byName = await model.findOne({ name: new RegExp(`^${escapeRx(raw)}$`, 'i') })
    .select(FIELDS).lean().catch(() => null);
  if (byName) return { ...byName, matchedVia: 'name' };

  // 3. The rename trail. renameProducts.js re-cut each slug from the new name,
  //    and Product's pre('save') pushed the old one into previousSlugs so the old
  //    URL keeps 301ing — which makes previousSlugs the record of what this
  //    product used to be called. Slugifying an old NAME reproduces the old SLUG,
  //    so the trail kept for search engines resolves the agents' stale refs too.
  const slug = slugify(raw);
  if (slug) {
    const bySlug = await model.findOne({ $or: [{ slug }, { previousSlugs: slug }] })
      .select(FIELDS).lean().catch(() => null);
    if (bySlug) return { ...bySlug, matchedVia: 'slug' };
  }

  return null;
}

module.exports = { findProductByRef };
