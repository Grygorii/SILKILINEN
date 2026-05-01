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

type Props = { reviews: ReviewData[] };

export default function ReviewsCarousel({ reviews }: Props) {
  const [paused, setPaused] = useState(false);
  const [mobileIndex, setMobileIndex] = useState(0);
  const touchStartX = useRef(0);

  if (reviews.length === 0) return null;

  const duration = Math.max(30, reviews.length * 4);
  const doubled = [...reviews, ...reviews];

  function prevCard() { setMobileIndex(i => (i - 1 + reviews.length) % reviews.length); }
  function nextCard() { setMobileIndex(i => (i + 1) % reviews.length); }

  return (
    <div className={styles.root}>
      {/* ── Desktop infinite scroll ── */}
      <div
        className={styles.desktopTrack}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div
          className={`${styles.track} ${paused ? styles.trackPaused : ''}`}
          style={{ animationDuration: `${duration}s` }}
        >
          {doubled.map((r, i) => <Card key={i} review={r} />)}
        </div>
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
        <Card review={reviews[mobileIndex]} />
        <div className={styles.mobileNav}>
          <button className={styles.arrow} onClick={prevCard} aria-label="Previous review">‹</button>
          <span className={styles.mobileCount}>{mobileIndex + 1} / {reviews.length}</span>
          <button className={styles.arrow} onClick={nextCard} aria-label="Next review">›</button>
        </div>
      </div>
    </div>
  );
}
