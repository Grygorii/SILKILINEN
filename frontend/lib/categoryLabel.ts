import { apiList } from './apiFetch';

// The human label for a category slug — asked for, not guessed.
//
// The product page derived its breadcrumb by prettifying the SLUG:
// `lounge` -> "Lounge". The real label, which the admin sets and
// /api/categories has always returned, is "Loungewear". It was wrong on five
// of twelve categories:
//
//   lounge      -> "Lounge"       should be "Loungewear"
//   home        -> "Home"         should be "Home & Sleep"
//   pillowcases -> "Pillowcases"  should be "Sleep Essential"
//   shorts      -> "Shorts"       should be "Lounge Shorts"
//   shirts      -> "Shirts"       should be "Lounge Shirts"
//
// Same shape as every other bug this codebase keeps producing: a fact that
// lives in one place (Category.label) is re-derived somewhere else and drifts.
// A slug is an identifier, not a name, and the two stop matching the moment
// someone renames a category — which is exactly what happened.

type Cat = { slug: string; label: string };

/**
 * Label for one slug. Falls back to the prettified slug when the category is
 * unknown or the API is unreachable, so a breadcrumb never renders empty —
 * but it is a fallback now, not the primary source.
 */
export async function categoryLabel(slug?: string | null): Promise<string | null> {
  if (!slug) return null;
  const cats = await apiList<Cat>(`${process.env.NEXT_PUBLIC_API_URL}/api/categories`, {
    // Categories change rarely; this is shared with the shop page's own fetch.
    next: { revalidate: 300 },
  });
  const hit = cats.find(c => c.slug === slug);
  if (hit?.label) return hit.label;
  return String(slug).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
