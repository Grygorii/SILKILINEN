'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './StyleFinderBand.module.css';

/**
 * Homepage Style Finder entry band. A thin silk ribbon unfurls (draws itself)
 * the first time the band scrolls into view, leading the eye down to the CTA.
 * The button carries a gentle copper→blush shift on hover and a soft breathing
 * pulse, evoking the way silk changes in light. All motion is suppressed for
 * reduced-motion users (the ribbon then simply shows, fully drawn).
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
    >
      <svg
        className={styles.ribbon}
        viewBox="0 0 60 240"
        fill="none"
        aria-hidden="true"
        preserveAspectRatio="xMidYMin meet"
      >
        <defs>
          <linearGradient id="silkRibbon" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C4A882" />
            <stop offset="100%" stopColor="#D9A6A0" />
          </linearGradient>
        </defs>
        <path
          className={styles.ribbonPath}
          pathLength={1}
          d="M30 2 C 12 36, 48 72, 30 108 C 12 144, 48 180, 30 238"
          stroke="url(#silkRibbon)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <span className={styles.finderEyebrow}>The 60-second quiz</span>
      <span className={styles.finderTitle}>Which silk are you?</span>
      <span className={styles.finderCue}>
        Answer four quiet questions and we&rsquo;ll gather the pieces made for you.
      </span>
      <span className={styles.finderBtn}>Take the Style Finder &rarr;</span>
    </a>
  );
}
