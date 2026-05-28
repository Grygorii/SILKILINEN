'use client';

import { useEffect, useState } from 'react';
import ProductCard, { type ProductCardData } from './ProductCard';
import styles from './RecentlyViewed.module.css';

type ViewedProduct = {
  id: string;
  name: string;
  price: number;
  image?: string;
};

const KEY = 'silkilinen_recently_viewed';
const MAX = 4;
const API = process.env.NEXT_PUBLIC_API_URL;

export function trackProductView(id: string, name: string, price: number, image?: string) {
  try {
    const raw = localStorage.getItem(KEY);
    const existing: ViewedProduct[] = raw ? JSON.parse(raw) : [];
    const filtered = existing.filter(p => p.id !== id);
    const updated = [{ id, name, price, image }, ...filtered].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(updated));
  } catch { /* ignore */ }
}

export default function RecentlyViewed({ excludeId }: { excludeId: string }) {
  const [products, setProducts] = useState<ProductCardData[]>([]);

  useEffect(() => {
    async function loadAndValidate() {
      try {
        const raw = localStorage.getItem(KEY);
        const all: ViewedProduct[] = raw ? JSON.parse(raw) : [];
        const candidates = all.filter(p => p.id !== excludeId);
        if (candidates.length === 0) return;

        // Re-fetch each product so the card has full data (images, material,
        // createdAt) — localStorage only stored the bare minimum.
        const validated = (await Promise.all(
          candidates.map(async (p) => {
            try {
              const res = await fetch(`${API}/api/products/${p.id}`);
              if (!res.ok) return null;
              const product = await res.json();
              if (product.status !== 'active') return null;
              return product as ProductCardData;
            } catch {
              return null;
            }
          })
        )).filter((p): p is ProductCardData => p !== null);

        // Write back only valid IDs so future loads skip deleted products
        const validIds = new Set(validated.map(p => p._id));
        const fullList: ViewedProduct[] = raw ? JSON.parse(raw) : [];
        localStorage.setItem(KEY, JSON.stringify(fullList.filter(p => validIds.has(p.id))));

        setProducts(validated);
      } catch { /* ignore */ }
    }
    loadAndValidate();
  }, [excludeId]);

  if (products.length === 0) return null;

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Recently viewed</h2>
      <div className={styles.grid}>
        {products.map(p => (
          <ProductCard key={p._id} product={p} />
        ))}
      </div>
    </section>
  );
}
