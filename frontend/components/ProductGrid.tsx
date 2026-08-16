'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProductCard, { type ProductCardData } from './ProductCard';
import styles from './ProductGrid.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Category = { slug: string; label: string; count: number };

type Product = ProductCardData & {
  category?: string;
  description?: string;
};

export default function ProductGrid({
  products,
  currentCategory = 'all',
  reachable = true,
}: {
  products: Product[];
  currentCategory?: string;
  /** false when the product API could not be reached, so an outage is not
   *  reported to the customer as an empty catalogue. */
  reachable?: boolean;
}) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetch(`${API}/api/categories`)
      .then(r => r.ok ? r.json() : [])
      .then((data: Category[]) => setCategories(data.filter(c => c.count > 0)))
      .catch(() => {});
  }, []);

  function selectCategory(slug: string) {
    if (slug === 'all') {
      router.push('/shop');
    } else {
      router.push(`/shop?category=${slug}`);
    }
  }

  return (
    <div>
      <div className={styles.filters}>
        <button
          className={`${styles.filterBtn} ${currentCategory === 'all' ? styles.active : ''}`}
          onClick={() => selectCategory('all')}
        >
          All
        </button>
        {categories.map(cat => (
          <button
            key={cat.slug}
            className={`${styles.filterBtn} ${currentCategory === cat.slug ? styles.active : ''}`}
            onClick={() => selectCategory(cat.slug)}
          >
            {cat.label.toUpperCase()}
          </button>
        ))}
      </div>

      {products.length === 0 ? (
        <div className={styles.emptyState}>
          {/* An unreachable API and an empty category look identical once the
              fetch has fallen back to []. Telling a customer "no products yet"
              during an outage is a lie that costs the visit. */}
          <p className={styles.emptyStateText}>
            {reachable === false
              ? 'We couldn\u2019t load the collection just now. Please refresh in a moment.'
              : 'No products in this category yet — check back soon.'}
          </p>
          <button
            className={styles.emptyStateBtn}
            onClick={() => selectCategory('all')}
          >
            Browse all products
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {products.map((product, i) => (
            // First row eager-loads + preloads (the LCP image lives here); the
            // rest lazy-load as the shopper scrolls.
            <ProductCard key={product._id} product={product} priority={i < 4} />
          ))}
        </div>
      )}
    </div>
  );
}
