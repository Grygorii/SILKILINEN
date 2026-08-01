import { localeHref, type PageLocale } from './i18n';

// SINGLE SOURCE OF TRUTH for storefront URLs.
//
// Why this exists: product links used to be hand-built in six places, three
// different ways (`slug`, `_id`, `slug || _id`). The colour-swatch links used
// the raw ObjectId, so Google indexed /product/<ObjectId> alongside the real
// slug URL — two URLs for one page, splitting ranking signals. Centralising it
// means every link is canonical BY CONSTRUCTION, and a new component can't
// reinvent a broken variant.
//
// Rule: never write `/product/${...}` by hand — call productPath/productHref.

export type Linkable = { slug?: string | null; _id?: string | null };

/** Canonical path for a product: always the slug when one exists. */
export function productPath(p: Linkable | null | undefined): string {
  const id = (p?.slug && String(p.slug).trim()) || (p?._id && String(p._id).trim()) || '';
  return id ? `/product/${id}` : '/shop';
}

/** Canonical, locale-aware href for a product (English stays unprefixed). */
export function productHref(p: Linkable | null | undefined, locale: PageLocale = 'en'): string {
  return localeHref(locale, productPath(p));
}

/** Canonical path for a collection. */
export function collectionPath(c: { slug?: string | null } | null | undefined): string {
  const s = c?.slug && String(c.slug).trim();
  return s ? `/collections/${s}` : '/shop';
}

export function collectionHref(c: { slug?: string | null } | null | undefined, locale: PageLocale = 'en'): string {
  return localeHref(locale, collectionPath(c));
}

/** Canonical path for a category listing. */
export function categoryPath(slug?: string | null): string {
  const s = slug && String(slug).trim();
  return s ? `/shop?category=${encodeURIComponent(s)}` : '/shop';
}

export function categoryHref(slug: string | null | undefined, locale: PageLocale = 'en'): string {
  return localeHref(locale, categoryPath(slug));
}
