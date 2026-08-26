'use client';

import { useState, useRef } from 'react';
import styles from './ReviewsCarousel.module.css';

export type ReviewData = {
  _id: string;
  reviewer: string;
  message: string;
  starRating: number;
  dateReviewed: string;
};

function Stars({ n }: { n: number }) {
  return (
    <span className={styles.stars} aria-label={`${n} out of 5 stars`}>
      {'★'.repeat(n)}{'☆'.repeat(5 - n)}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IE', { month: 'short', year: 'numeric' });
}

function firstName(name: string) {
  return name.split(' ')[0];
}

function Card({ review }: { review: ReviewData }) {
  return (
    <div className={styles.card}>
      <Stars n={review.starRating} />
      <p className={styles.message}>{review.message}</p>
      <div className={styles.meta}>
        <span className={styles.name}>{firstName(review.reviewer)}</span>
        <span className={styles.date}>{formatDate(review.dateReviewed)}</span>
      </div>
    </div>
  );
}

/**
 * §16: show at most three.
 *
 * Twelve reviews in an auto-scrolling marquee is wallpaper. Nobody reads past
 * the second card, and a phone visitor was being asked to swipe twelve times to
 * see the end of a strip that loops anyway. Three specific reviews — quality,
 * comfort, fit, colour, packaging — are an argument; twelve are decoration.
 *
 * The cap lives HERE rather than in the caller's slice, and the caller imports
 * it to size its own curation. Two numbers meaning "how many reviews" in two
 * files is how a component ends up rendering four.
 */
export const MAX_REVIEWS = 3;

type Props = { reviews: ReviewData[] };

export default function ReviewsCarousel({ reviews: incoming }: Props) {
  const [mobileIndex, setMobileIndex] = useState(0);
  const touchStartX = useRef(0);

  const reviews = incoming.slice(0, MAX_REVIEWS);
  if (reviews.length === 0) return null;

  // The index survives a shorter list: if the caller ever passes fewer reviews
  // than the last render, a stale index would read past the end.
  const index = Math.min(mobileIndex, reviews.length - 1);

  function prevCard() { setMobileIndex(i => (i - 1 + reviews.length) % reviews.length); }
  function nextCard() { setMobileIndex(i => (i + 1) % reviews.length); }

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className={styles.root}>
      {/* ── Desktop: three, standing still ──
          This was an infinite marquee, which only worked because there were
          twelve cards to fill it. At three the track duplicates its own
          contents to have something to scroll, so a wide screen showed
          1-2-3-1-2-3 side by side — the same three reviews, visibly repeating,
          which reads as a shop with three reviews trying to look like six.
          Three cards fit a row. A row does not need to move. */}
      <div className={styles.desktopRow}>
        {reviews.map((r, i) => <Card key={i} review={r} />)}
      </div>

      {/* ── Mobile single-card swipe ── */}
      <div
        className={styles.mobileTrack}
        onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={e => {
          const diff = touchStartX.current - e.changedTouches[0].clientX;
          if (Math.abs(diff) > 40) diff > 0 ? nextCard() : prevCard();
        }}
      >
        <Card review={reviews[index]} />
        <div className={styles.mobileNav}>
          <button className={styles.arrow} onClick={prevCard} aria-label="Previous review">←</button>
          {/* 01 / 03, not 1 / 12. Zero-padded so the counter keeps its width
              between cards instead of nudging the arrows as the digit changes. */}
          <span className={styles.mobileCount}>{pad(index + 1)} / {pad(reviews.length)}</span>
          <button className={styles.arrow} onClick={nextCard} aria-label="Next review">→</button>
        </div>
      </div>
    </div>
  );
}
