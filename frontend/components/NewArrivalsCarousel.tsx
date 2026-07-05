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

  // Click-and-drag to scroll with a mouse/pen. Touch is left to native
  // momentum scrolling (already smooth on phones), so we ignore touch pointers
  // here. `moved` suppresses the card-link click at the end of a drag.
  const dragging = useRef(false);
  const moved = useRef(false);
  const startX = useRef(0);
  const startScroll = useRef(0);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    const el = trackRef.current;
    if (!el) return;
    dragging.current = true;
    moved.current = false;
    startX.current = e.clientX;
    startScroll.current = el.scrollLeft;
    el.classList.add(styles.dragging);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const el = trackRef.current;
    if (!el) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > 3) moved.current = true;
    el.scrollLeft = startScroll.current - dx;
  };
  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    trackRef.current?.classList.remove(styles.dragging);
  };
  const onClickCapture = (e: React.MouseEvent) => {
    if (moved.current) {
      e.preventDefault();
      e.stopPropagation();
      moved.current = false;
    }
  };

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>New Arrivals</h2>
        <Link href="/shop?new=true" className={styles.viewAll}>Discover more →</Link>
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

        <div
          className={styles.track}
          ref={trackRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
          onClickCapture={onClickCapture}
        >
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
