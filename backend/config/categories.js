'use strict';

// The canonical category list.
//
// These are the SIX consolidated slugs, the ones actually live in the shop.
// Nine near-overlapping categories were merged down by
// scripts/consolidateCategories.js — but this file still listed the original
// nine long afterwards, which made it actively wrong in two ways:
// scripts/migrateCategories.js reported live products (sleepwear, lounge, home)
// as sitting outside the canonical list, while treating merged-away slugs as
// canonical. The database is the real source of truth; this list exists for the
// seed, the migration check and the Product default, so it has to match it.
//
// The retired slugs are NOT listed here. They keep working as URLs through
// RETIRED_CATEGORIES in frontend/app/(shop)/shop/page.tsx, which 301s each one
// to the category it was merged into — kept next to the route because that is
// where a category URL is resolved.
const CATEGORIES = [
  { slug: 'robes',     label: 'Robes' },
  { slug: 'sleepwear', label: 'Sleepwear' },
  { slug: 'lingerie',  label: 'Lingerie' },
  { slug: 'lounge',    label: 'Loungewear' },
  { slug: 'home',      label: 'Home & Sleep' },
  { slug: 'scarves',   label: 'Scarves' },
];

const SLUGS = CATEGORIES.map(c => c.slug);

// The fallback for a product saved without a category, named EXPLICITLY.
//
// It used to be SLUGS[0] — a positional reference, so reordering the list above
// (a display-order tweak, an alphabetical tidy) would silently change the
// default category of every product created afterwards, with nothing failing.
// A wrong category is repeated in the breadcrumb, the shop filter and the
// Shopping feed's product_type, so that edit would have been wrong in three
// customer-facing places and mentioned in none.
//
// This is a fallback, not a choice: a product that lands here is one nobody
// filed. services/advisor.js flags a garment sitting in the wrong category, so
// an unfiled robe-defaulted product surfaces there rather than staying hidden.
const DEFAULT_CATEGORY = 'robes';

module.exports = { CATEGORIES, SLUGS, DEFAULT_CATEGORY };
