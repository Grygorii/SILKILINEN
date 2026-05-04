import type { Metadata } from 'next';
import ProductGrid from '@/components/ProductGrid';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Shop — SILKILINEN',
  description: 'Browse the full SILKILINEN collection of pure silk and linen intimates. Robes, slips, dresses and sets, shipped worldwide from Dublin.',
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

const VALID_SLUGS = new Set(Object.keys(CATEGORY_COPY));

async function getProducts(category?: string, q?: string) {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (q) params.set('q', q);
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
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const { category, q } = await searchParams;

  if (category && !VALID_SLUGS.has(category)) {
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

  const products = await getProducts(category, q);
  const copy = category ? CATEGORY_COPY[category] : null;

  return (
    <main className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>{copy?.title ?? (q ? `Search: "${q}"` : 'The Collection')}</h1>
        {copy?.description && (
          <p className={styles.description}>{copy.description}</p>
        )}
      </div>
      <ProductGrid products={products} currentCategory={category ?? 'all'} />
    </main>
  );
}
