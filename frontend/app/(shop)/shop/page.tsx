import type { Metadata } from 'next';
import { apiList, apiListResult } from '@/lib/apiFetch';
import SearchTracker from '@/components/SearchTracker';
import { notFound, permanentRedirect } from 'next/navigation';
import { clampMeta } from '@/lib/clampMeta';
import { getLocale, apiLocaleQuery, hreflangAlternates, localeUrl, type PageLocale } from '@/lib/i18n-server';
import { categoryHref } from '@/lib/urls';
import ProductGrid from '@/components/ProductGrid';
import BundleStrip from '@/components/BundleStrip';
import styles from './page.module.css';

type Cat = { slug: string; label: string; description?: string; metaTitle?: string; metaDescription?: string; count: number };

// The storefront's source of truth for which categories exist is the DB, not a
// hardcoded list — so renaming or adding a category in admin "just works" on
// the shop page. CATEGORY_COPY (below) is only an optional rich-copy override
// for SEO; a category is valid as long as it exists here.
async function getCategoryList(locale: PageLocale = 'en'): Promise<Cat[]> {
  const q = apiLocaleQuery(locale);
  return apiList<Cat>(`${process.env.NEXT_PUBLIC_API_URL}/api/categories${q ? `?${q}` : ''}`, { next: { revalidate: 300 } });
}

// Per-category metadata so /shop?category=robes gets a different
// title + description from /shop?category=pyjamas. The base /shop URL
// keeps the collection-wide description. Without this, every category
// variant shared one generic meta and Google's audit flagged it as
// duplicate content.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; new?: string; q?: string }>;
}): Promise<Metadata> {
  const { category, new: newParam, q } = await searchParams;
  const locale = await getLocale();
  // Search-result permutations are thin/duplicate — keep them out of the index.
  if (q) {
    return {
      title: `Search: "${q}"`,
      robots: { index: false, follow: true },
      alternates: { canonical: localeUrl(locale, '/shop') },
    };
  }
  if (category) {
    // Precedence: the founder's approved meta (generated in admin) wins, then
    // the curated hardcoded copy, then the category's own label/description.
    // metaTitle is empty until the founder generates+approves, so existing
    // hardcoded categories (robes, pyjamas…) are unchanged until then.
    const dbCat = (await getCategoryList(locale)).find(x => x.slug === category);
    const c = CATEGORY_COPY[category];
    // Only an existing category WITH products is a real, indexable page.
    if (dbCat && dbCat.count > 0) {
      const path = `/shop?category=${category}`;
      return {
        title: dbCat?.metaTitle || c?.title || dbCat?.label || 'Shop',
        description: clampMeta(
          dbCat?.metaDescription ||
          c?.description ||
          dbCat?.description ||
          `Shop ${dbCat?.label || 'silk'} at Silkilinen — pure silk and linen, shipped worldwide from Donegal.`),
        // Self-referencing canonical per locale + hreflang across all languages.
        alternates: { canonical: localeUrl(locale, path), languages: hreflangAlternates(path) },
      };
    }
    // Unknown/stale category slug (e.g. a renamed or removed category like
    // ?category=home) renders an empty grid that Google flags as a soft 404.
    // Keep it out of the index and point the canonical at the real shop.
    return {
      title: 'Shop',
      robots: { index: false, follow: true },
      alternates: { canonical: localeUrl(locale, '/shop') },
    };
  }
  if (newParam === 'true') {
    return {
      title: 'New Arrivals',
      description: 'The latest silk and linen pieces from Silkilinen — fresh arrivals, shipped worldwide from Donegal.',
      alternates: { canonical: localeUrl(locale, '/shop?new=true'), languages: hreflangAlternates('/shop?new=true') },
    };
  }
  return {
    title: 'Shop',
    description: 'The full Silkilinen collection of pure silk and linen intimates — robes, slips, dresses, lounge, sleep. From an Irish brand based in Donegal, shipped worldwide.',
    alternates: { canonical: localeUrl(locale, '/shop'), languages: hreflangAlternates('/shop') },
  };
}

// Slugs merged away by scripts/consolidateCategories.js -> their new parent.
// Kept next to the shop route because this is where a category URL is resolved.
const RETIRED_CATEGORIES: Record<string, string> = {
  shorts: 'lounge',
  shirts: 'lounge',
  'eye-masks': 'home',
  pillowcases: 'home',
  'sleep-dresses': 'sleepwear',
  pyjamas: 'sleepwear',
};

const CATEGORY_COPY: Record<string, { title: string; description: string }> = {
  robes: {
    title: 'Silk Robes',
    description: 'Discover our collection of pure silk robes, crafted in butter-soft mulberry silk. Effortlessly elegant for morning rituals and quiet evenings at home.',
  },
  pyjamas: {
    title: 'Pyjama Sets',
    description: 'Pure silk pyjamas that feel as beautiful as they look. Tailored for rest, designed to be seen.',
  },
  'sleep-dresses': {
    title: 'Sleep Dresses',
    description: 'Fluid, graceful silk sleep dresses that move with you. From slip dresses to bias-cut silhouettes — each piece a study in understated luxury.',
  },
  lingerie: {
    title: 'Lingerie',
    description: 'Delicate silk intimates, finished with refined details. The quiet luxury of silk against skin.',
  },
  shorts: {
    title: 'Lounge Shorts',
    description: 'Pure silk shorts for lounging in style. Relaxed fit, refined feel.',
  },
  shirts: {
    title: 'Lounge Shirts',
    description: 'Silk shirts that carry the quiet authority of natural luxury. Worn in, worn well.',
  },
  pillowcases: {
    title: 'Silk Pillowcases',
    description: 'Sleep on pure silk. Gentler on hair and skin, cooler through the night.',
  },
  'eye-masks': {
    title: 'Silk Eye Masks',
    description: 'Block out the world in pure silk. Weighted comfort, zero compromise.',
  },
  scarves: {
    title: 'Silk Scarves',
    description: 'Pure silk scarves — worn a hundred ways, remembered for one.',
  },
};

async function getProducts(category?: string, q?: string, newOnly?: boolean, locale: PageLocale = 'en') {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (q) params.set('q', q);
  if (newOnly) {
    params.set('isNew', 'true');
    params.set('sort', '-createdAt');
  }
  if (locale !== 'en') params.set('locale', locale);
  const qs = params.toString();
  const url = `${process.env.NEXT_PUBLIC_API_URL}/api/products${qs ? `?${qs}` : ''}`;
  // Timed out rather than open-ended: this runs during render, so a hanging
  // API would hold the whole route until Vercel's function timeout.
  // Untyped like the original — ProductGrid owns the card shape, and
  // duplicating it here would be one more copy to keep in step.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return apiListResult<any>(url, { next: { revalidate: 60 } });
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; new?: string }>;
}) {
  const { category, q, new: newParam } = await searchParams;
  const newOnly = newParam === 'true' && !category;
  const locale = await getLocale();

  // Validate against the live categories, not a hardcoded list. A category that
  // doesn't exist OR has no products isn't a real, browsable page — return a
  // proper 404 so it's not accessible and Google doesn't index a thin/empty grid.
  const liveCats = category ? await getCategoryList(locale) : [];
  const dbCat = category ? liveCats.find(c => c.slug === category) : null;

  // …unless it's a slug we deliberately merged away: send it to its new parent
  // so the ranking it earned carries over instead of 404ing (?category=shorts
  // was live in Search Console). Deliberately CONDITIONAL — it only fires once
  // the old category is actually gone AND the target exists, so this is safe to
  // ship before scripts/consolidateCategories.js runs and keeps working after.
  //
  // Done here rather than via next.config redirects because Next passes the
  // request's query through to the destination: a config redirect from
  // ?category=shorts to ?category=lounge yields ?category=lounge&category=shorts
  // (a duplicate param the page can't read), and pointing it at /shop would
  // re-append ?category=shorts and loop forever.
  if (category && (!dbCat || dbCat.count === 0)) {
    const mergedInto = RETIRED_CATEGORIES[category];
    const target = mergedInto && liveCats.find(c => c.slug === mergedInto && c.count > 0);
    if (target) permanentRedirect(categoryHref(mergedInto, locale));
    notFound();
  }

  const { items: products, reachable } = await getProducts(category, q, newOnly, locale);
  const copy = category ? CATEGORY_COPY[category] : null;
  const heading = copy?.title ?? dbCat?.label ?? (newOnly ? 'New Arrivals' : (q ? `Search: "${q}"` : 'The Collection'));
  const description = copy?.description ?? (dbCat?.description || null) ?? (newOnly ? 'Our latest pieces — fresh off the atelier table.' : null);

  return (
    <main className={styles.page}>
      {/* Records the query AND how many products it returned. A zero-result
          search is the clearest demand signal the shop can produce. */}
      {q && <SearchTracker query={q} results={products.length} />}
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>{heading}</h1>
        {description && (
          <p className={styles.description}>{description}</p>
        )}
      </div>
      {category && <BundleStrip category={category} />}
      <ProductGrid products={products} currentCategory={category ?? 'all'} reachable={reachable} />
    </main>
  );
}
