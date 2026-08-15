'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ProductCard, { type ProductCardData } from './ProductCard';
import styles from './NewArrivals.module.css';

// Horizontal carousel for New Arrivals. Shows however many products the admin
// has flagged (no fixed cap) with native swipe on touch and prev/next arrows on
// pointer devices. Arrows disable at the ends and the whole row hides nothing —
// it just scrolls. "View all" goes to the new-arrivals-only shop view.
export default function NewArrivalsCarousel({ products }: { products: ProductCardData[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  // Scroll reveal: the row settles in rather than appearing as a block of
  // search results. Starts FALSE and the pre-reveal styles only apply once
  // `armed` is set on mount, so a no-JS/crawler render shows the cards
  // normally and they can never get stuck invisible.
  const [armed, setArmed] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setRevealed(true); return; }
    setArmed(true);
    const io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) { setRevealed(true); io.disconnect(); }
      },
      { rootMargin: '0px 0px -12% 0px' },
    );
    io.observe(el);
    // Failsafe: reveal regardless after a moment, so nothing can stay hidden
    // if the observer never fires (odd viewports, restored scroll positions).
    const t = setTimeout(() => { setRevealed(true); io.disconnect(); }, 2000);
    return () => { io.disconnect(); clearTimeout(t); };
  }, []);
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
    <section
      ref={sectionRef}
      className={`${styles.section} ${armed ? styles.armed : ''} ${revealed ? styles.revealed : ''}`}
      aria-labelledby="new-arrivals-heading"
    >
      {/* Visually hidden: the design starts with products (no visible title),
          but the outline still needs an h2 here — without it the homepage
          skipped h1 -> h3, breaking heading navigation for screen readers. */}
      <h2 id="new-arrivals-heading" className="srOnly">New Arrivals</h2>

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
          {products.map((product, i) => (
            <div
              className={styles.item}
              key={product._id}
              style={{ '--reveal-i': i } as React.CSSProperties}
            >
              <ProductCard product={product} playSheen={revealed} />
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
