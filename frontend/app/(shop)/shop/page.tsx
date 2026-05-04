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
  dresses: {
    title: 'Silk Dresses',
    description: 'Fluid, graceful silk dresses that move with you. From slip dresses to bias-cut silhouettes — each piece a study in understated luxury.',
  },
  pyjamas: {
    title: 'Silk Pyjamas',
    description: 'Pure silk pyjamas that feel as beautiful as they look. Tailored for rest, designed to be seen.',
  },
  lingerie: {
    title: 'Silk Lingerie',
    description: 'Delicate silk intimates, finished with refined details. The quiet luxury of silk against skin.',
  },
  accessories: {
    title: 'Silk Accessories',
    description: 'Scarves, eye masks, and silk hair accessories — small pieces, lasting impressions.',
  },
  shorts: {
    title: 'Silk Shorts',
    description: 'Pure silk shorts for lounging in style. Relaxed fit, refined feel.',
  },
  shirts: {
    title: 'Silk Shirts',
    description: 'Silk shirts that carry the quiet authority of natural luxury. Worn in, worn well.',
  },
};

async function getProducts(category?: string) {
  const url = category
    ? `${process.env.NEXT_PUBLIC_API_URL}/api/products?category=${category}`
    : `${process.env.NEXT_PUBLIC_API_URL}/api/products`;
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
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const products = await getProducts(category);
  const copy = category ? CATEGORY_COPY[category] : null;

  return (
    <main className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>{copy?.title ?? 'The Collection'}</h1>
        {copy?.description && (
          <p className={styles.description}>{copy.description}</p>
        )}
      </div>
      <ProductGrid products={products} />
    </main>
  );
}
