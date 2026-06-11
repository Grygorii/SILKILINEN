import type { Metadata } from 'next';
import ProductGrid from '@/components/ProductGrid';
import BundleStrip from '@/components/BundleStrip';
import styles from './page.module.css';

type Cat = { slug: string; label: string; description?: string; count: number };

// The storefront's source of truth for which categories exist is the DB, not a
// hardcoded list — so renaming or adding a category in admin "just works" on
// the shop page. CATEGORY_COPY (below) is only an optional rich-copy override
// for SEO; a category is valid as long as it exists here.
async function getCategoryList(): Promise<Cat[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/categories`, { next: { revalidate: 300 } });
    return res.ok ? res.json() : [];
  } catch {
    return [];
  }
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
  // Search-result permutations are thin/duplicate — keep them out of the index.
  if (q) {
    return {
      title: `Search: "${q}"`,
      robots: { index: false, follow: true },
      alternates: { canonical: 'https://www.silkilinen.com/shop' },
    };
  }
  if (category) {
    // Rich hardcoded copy wins; otherwise fall back to the live category's
    // own label/description so newly added categories still get real metadata.
    const c = CATEGORY_COPY[category];
    if (c) {
      return {
        title: c.title,
        description: c.description,
        alternates: { canonical: `https://www.silkilinen.com/shop?category=${category}` },
      };
    }
    const dbCat = (await getCategoryList()).find(x => x.slug === category);
    if (dbCat) {
      return {
        title: dbCat.label,
        description: dbCat.description || `Shop ${dbCat.label} at Silkilinen — pure silk and linen, shipped worldwide from Donegal.`,
        alternates: { canonical: `https://www.silkilinen.com/shop?category=${category}` },
      };
    }
  }
  if (newParam === 'true') {
    return {
      title: 'New Arrivals',
      description: 'The latest silk and linen pieces from Silkilinen — fresh arrivals, shipped worldwide from Donegal.',
      alternates: { canonical: 'https://www.silkilinen.com/shop?new=true' },
    };
  }
  return {
    title: 'Shop',
    description: 'The full Silkilinen collection of pure silk and linen intimates — robes, slips, dresses, lounge, sleep. From an Irish brand based in Donegal, shipped worldwide.',
    alternates: { canonical: 'https://www.silkilinen.com/shop' },
  };
}

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

async function getProducts(category?: string, q?: string, newOnly?: boolean) {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (q) params.set('q', q);
  if (newOnly) {
    params.set('isNew', 'true');
    params.set('sort', '-createdAt');
  }
  const qs = params.toString();
  const url = `${process.env.NEXT_PUBLIC_API_URL}/api/products${qs ? `?${qs}` : ''}`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    return res.ok ? res.json() : [];
  } catch {
    return [];
  }
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; new?: string }>;
}) {
  const { category, q, new: newParam } = await searchParams;
  const newOnly = newParam === 'true' && !category;

  // Validate against the live categories, not a hardcoded list.
  const dbCat = category ? (await getCategoryList()).find(c => c.slug === category) : null;

  if (category && !dbCat) {
    return (
      <main className={styles.page}>
        <div className={styles.pageHeader}>
          <h1 className={styles.title}>Category not found</h1>
          <p className={styles.description}>
            We don&apos;t have a &ldquo;{category}&rdquo; collection.{' '}
            <a href="/shop" style={{ color: 'inherit', textDecoration: 'underline' }}>Browse all products →</a>
          </p>
        </div>
      </main>
    );
  }

  const products = await getProducts(category, q, newOnly);
  const copy = category ? CATEGORY_COPY[category] : null;
  const heading = copy?.title ?? dbCat?.label ?? (newOnly ? 'New Arrivals' : (q ? `Search: "${q}"` : 'The Collection'));
  const description = copy?.description ?? (dbCat?.description || null) ?? (newOnly ? 'Our latest pieces — fresh off the atelier table.' : null);

  return (
    <main className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>{heading}</h1>
        {description && (
          <p className={styles.description}>{description}</p>
        )}
      </div>
      {category && <BundleStrip category={category} />}
      <ProductGrid products={products} currentCategory={category ?? 'all'} />
    </main>
  );
}
