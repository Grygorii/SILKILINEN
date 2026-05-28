'use client';

import { useEffect, useRef } from 'react';

// Single shared IntersectionObserver across all useReveal() consumers.
// Each observed element fires once, then is unobserved — cards in long
// grids don't accumulate observer overhead. SSR-safe: guards window
// and the IntersectionObserver constructor.

let sharedObserver: IntersectionObserver | null = null;

function getObserver(): IntersectionObserver | null {
  if (typeof window === 'undefined') return null;
  if (sharedObserver) return sharedObserver;
  if (!('IntersectionObserver' in window)) return null;
  sharedObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          sharedObserver?.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
  );
  return sharedObserver;
}

export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === 'undefined') return;

    // Reduced-motion users: keep the element visible, never hide it.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const obs = getObserver();
    if (!obs) return;

    // If the element is already in (or above) the viewport at mount,
    // skip the reveal entirely — never hide it. This is what enforces
    // "above-the-fold content appears immediately." Only elements below
    // the fold get the .revealing class (which is invisible to the user
    // until they scroll, so no flash).
    const rect = el.getBoundingClientRect();
    const inViewportOrAbove = rect.top < window.innerHeight;
    if (inViewportOrAbove) return;

    el.classList.add('revealing');
    obs.observe(el);

    return () => obs.unobserve(el);
  }, []);

  return ref;
}
