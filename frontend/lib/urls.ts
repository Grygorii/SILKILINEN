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

/**
 * A shop listing URL with any combination of its parameters.
 *
 * Written once because the shop's controls have to PRESERVE each other: a sort
 * link that drops ?category lands the shopper back in the full catalogue, and
 * a category link that drops ?sort silently reorders the grid under them. Both
 * are the kind of fault nobody reports — the page just feels unreliable.
 *
 * Order is fixed (category, q, new, sort) so the same view always produces the
 * same string. Two spellings of one URL are two entries in Google's index and
 * two cache keys.
 *
 * Blank and default values are omitted rather than written as empty params:
 * /shop is the canonical form of /shop?category=&sort=featured.
 */
export type ShopParams = {
  category?: string | null;
  q?: string | null;
  /** New arrivals view. */
  isNew?: boolean;
  /** Omit or pass 'featured' for the shop's own order. */
  sort?: string | null;
};

export function shopPath(params: ShopParams = {}): string {
  const parts: string[] = [];
  const category = params.category && String(params.category).trim();
  const q = params.q && String(params.q).trim();
  const sort = params.sort && String(params.sort).trim();
  // encodeURIComponent, NOT URLSearchParams: the latter encodes a space as `+`
  // and this function backs categoryPath, whose output goes into canonical
  // tags. `%20` and `+` decode the same but are different URL STRINGS, so
  // switching would fork every canonical Google has already indexed.
  if (category) parts.push(`category=${encodeURIComponent(category)}`);
  if (q) parts.push(`q=${encodeURIComponent(q)}`);
  if (params.isNew) parts.push('new=true');
  if (sort && sort !== 'featured') parts.push(`sort=${encodeURIComponent(sort)}`);
  return parts.length ? `/shop?${parts.join('&')}` : '/shop';
}

/** Canonical path for a category listing. */
export function categoryPath(slug?: string | null): string {
  return shopPath({ category: slug });
}

export function categoryHref(slug: string | null | undefined, locale: PageLocale = 'en'): string {
  return localeHref(locale, categoryPath(slug));
}
