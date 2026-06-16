'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './StyleFinderBand.module.css';

/**
 * Homepage Style Finder entry band. A copper→blush silk bow ties itself
 * (draws itself) at the corner of the CTA the first time the band scrolls
 * into view — a nod to the brand's gift-wrapping. The button's gradient
 * drifts continuously and lifts with a shine sweep on hover, evoking the way
 * silk changes in light. All motion is suppressed for reduced-motion users
 * (the bow then simply shows, fully tied).
 */
export default function StyleFinderBand() {
  const ref = useRef<HTMLAnchorElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <a
      ref={ref}
      href="/style-finder"
      className={`${styles.finderBand} ${inView ? styles.inView : ''}`}
      data-track="quiz_cta"
    >
      <span className={styles.finderEyebrow}>The 60-second quiz</span>
      <span className={styles.finderTitle}>Which silk are you?</span>
      <span className={styles.finderCue}>
        Answer four quiet questions and we&rsquo;ll gather the pieces made for you.
      </span>
      <span className={styles.ctaWrap}>
        <span className={styles.finderBtn}>Take the Style Finder &rarr;</span>
        {/* A silk bow tied at the corner of the button — it draws itself ("ties")
            the first time the band scrolls into view. Nods to the brand's
            gift-wrapping (every piece arrives tied with silk ribbon). */}
        <svg className={styles.bow} viewBox="0 0 96 72" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="silkBow" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#C9A06F" />
              <stop offset="55%" stopColor="#D9A6A0" />
              <stop offset="100%" stopColor="#C4A882" />
            </linearGradient>
          </defs>
          <path
            className={styles.bowPath}
            pathLength={1}
            d="M48 31 C 28 8, 6 26, 22 38 C 33 46, 45 38, 48 31 M48 31 C 68 8, 90 26, 74 38 C 63 46, 51 38, 48 31 M46 34 C 40 50, 37 60, 31 71 M50 34 C 56 50, 59 60, 65 71"
            stroke="url(#silkBow)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect className={styles.bowKnot} x="44" y="26" width="8" height="11" rx="3" fill="url(#silkBow)" />
        </svg>
      </span>
    </a>
  );
}
