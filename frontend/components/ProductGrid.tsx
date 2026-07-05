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
}: {
  products: Product[];
  currentCategory?: string;
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
          <p className={styles.emptyStateText}>
            No products in this category yet — check back soon.
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
