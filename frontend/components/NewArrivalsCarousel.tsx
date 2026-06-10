'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ProductCard, { type ProductCardData } from './ProductCard';
import styles from './NewArrivals.module.css';

// Horizontal carousel for New Arrivals. Shows however many products the admin
// has flagged (no fixed cap) with native swipe on touch and prev/next arrows on
// pointer devices. Arrows disable at the ends and the whole row hides nothing —
// it just scrolls. "View all" goes to the new-arrivals-only shop view.
export default function NewArrivalsCarousel({ products }: { products: ProductCardData[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      window.removeEventListener('resize', updateArrows);
    };
  }, [updateArrows]);

  const scrollByPage = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' });
  };

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>New Arrivals</h2>
        <Link href="/shop?new=true" className={styles.viewAll}>View all →</Link>
      </div>

      <div className={styles.viewport}>
        <button
          type="button"
          aria-label="Previous"
          className={`${styles.arrow} ${styles.arrowPrev}`}
          onClick={() => scrollByPage(-1)}
          disabled={!canPrev}
        >
          <ChevronLeft size={20} strokeWidth={1.5} />
        </button>

        <div className={styles.track} ref={trackRef}>
          {products.map(product => (
            <div className={styles.item} key={product._id}>
              <ProductCard product={product} />
            </div>
          ))}
        </div>

        <button
          type="button"
          aria-label="Next"
          className={`${styles.arrow} ${styles.arrowNext}`}
          onClick={() => scrollByPage(1)}
          disabled={!canNext}
        >
          <ChevronRight size={20} strokeWidth={1.5} />
        </button>
      </div>
    </section>
  );
}
