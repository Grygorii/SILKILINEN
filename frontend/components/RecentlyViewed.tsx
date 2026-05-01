'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './RecentlyViewed.module.css';

type ViewedProduct = {
  id: string;
  name: string;
  price: number;
};

const KEY = 'silkilinen_recently_viewed';
const MAX = 4;

export function trackProductView(id: string, name: string, price: number) {
  try {
    const raw = localStorage.getItem(KEY);
    const existing: ViewedProduct[] = raw ? JSON.parse(raw) : [];
    const filtered = existing.filter(p => p.id !== id);
    const updated = [{ id, name, price }, ...filtered].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(updated));
  } catch { /* ignore */ }
}

export default function RecentlyViewed({ excludeId }: { excludeId: string }) {
  const [products, setProducts] = useState<ViewedProduct[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      const all: ViewedProduct[] = raw ? JSON.parse(raw) : [];
      setProducts(all.filter(p => p.id !== excludeId));
    } catch { /* ignore */ }
  }, [excludeId]);

  if (products.length === 0) return null;

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Recently viewed</h2>
      <div className={styles.grid}>
        {products.map(p => (
          <Link key={p.id} href={`/product/${p.id}`} className={styles.card}>
            <div className={styles.img} />
            <p className={styles.name}>{p.name}</p>
            <p className={styles.price}>€{Number(p.price).toFixed(2)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
