'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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
  const [products, setProducts] = useState<ViewedProduct[]>([]);

  useEffect(() => {
    async function loadAndValidate() {
      try {
        const raw = localStorage.getItem(KEY);
        const all: ViewedProduct[] = raw ? JSON.parse(raw) : [];
        const candidates = all.filter(p => p.id !== excludeId);
        if (candidates.length === 0) return;

        const validated = (await Promise.all(
          candidates.map(async (p) => {
            try {
              const res = await fetch(`${API}/api/products/${p.id}`);
              if (!res.ok) return null;
              const product = await res.json();
              if (product.status !== 'active') return null;
              // Pull the best available image from the full product response
              const image =
                product.images?.find((i: { isPrimary: boolean }) => i.isPrimary)?.url ||
                product.images?.[0]?.url ||
                product.image ||
                p.image;
              return { ...p, image } as ViewedProduct;
            } catch {
              return null;
            }
          })
        )).filter((p): p is ViewedProduct => p !== null);

        // Write back only valid IDs so future loads skip deleted products
        const validIds = validated.map(p => p.id);
        const fullList: ViewedProduct[] = raw ? JSON.parse(raw) : [];
        localStorage.setItem(KEY, JSON.stringify(fullList.filter(p => validIds.includes(p.id))));

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
          <Link key={p.id} href={`/product/${p.id}`} className={styles.card}>
            <div className={styles.img}>
              {p.image && (
                <img src={p.image} alt={p.name} className={styles.imgTag} loading="lazy" />
              )}
            </div>
            <p className={styles.name}>{p.name}</p>
            <p className={styles.price}>€{Number(p.price).toFixed(2)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
