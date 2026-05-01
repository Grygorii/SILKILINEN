'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Review = {
  _id: string;
  reviewer: string;
  message: string;
  starRating: number;
  dateReviewed: string;
  source: string;
  verified: boolean;
};

function Stars({ n, size = 'md' }: { n: number; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`${styles.stars} ${styles[`stars${size.toUpperCase()}`]}`} aria-label={`${n} out of 5 stars`}>
      {'★'.repeat(n)}{'☆'.repeat(5 - n)}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' });
}

function firstName(name: string) {
  return name.split(' ')[0];
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API}/api/reviews`)
      .then(r => r.json())
      .then(data => { setReviews(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const total = reviews.length;
  const avg = total ? reviews.reduce((s, r) => s + r.starRating, 0) / total : 0;

  const dist: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  reviews.forEach(r => { dist[r.starRating] = (dist[r.starRating] || 0) + 1; });

  const visible = filter ? reviews.filter(r => r.starRating === filter) : reviews;

  return (
    <main className={styles.page}>
      <div className={styles.inner}>

        {/* ── Header ── */}
        <header className={styles.header}>
          <h1>Customer reviews</h1>
          {!loading && total > 0 && (
            <div className={styles.summary}>
              <div className={styles.avgBlock}>
                <span className={styles.avgNumber}>{avg.toFixed(1)}</span>
                <Stars n={Math.round(avg)} size="lg" />
                <span className={styles.avgTotal}>Based on {total} reviews</span>
              </div>

              <div className={styles.distBlock}>
                {[5, 4, 3, 2, 1].map(star => {
                  const count = dist[star] || 0;
                  const pct = total ? (count / total) * 100 : 0;
                  return (
                    <button
                      key={star}
                      className={`${styles.distRow} ${filter === star ? styles.distRowActive : ''}`}
                      onClick={() => setFilter(filter === star ? null : star)}
                    >
                      <span className={styles.distLabel}>{star}★</span>
                      <div className={styles.distBar}>
                        <div className={styles.distFill} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={styles.distCount}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </header>

        {/* ── Filter indicator ── */}
        {filter && (
          <div className={styles.filterBar}>
            <span>Showing {filter}-star reviews</span>
            <button className={styles.clearFilter} onClick={() => setFilter(null)}>Clear filter ✕</button>
          </div>
        )}

        {/* ── Review grid ── */}
        {loading ? (
          <p className={styles.muted}>Loading reviews…</p>
        ) : visible.length === 0 ? (
          <p className={styles.muted}>No reviews found.</p>
        ) : (
          <div className={styles.grid}>
            {visible.map(r => (
              <article key={r._id} className={styles.card}>
                <div className={styles.cardTop}>
                  <Stars n={r.starRating} size="sm" />
                  {r.verified && (
                    <span className={styles.badge}>Verified Etsy purchase</span>
                  )}
                </div>
                {r.message ? (
                  <p className={styles.message}>{r.message}</p>
                ) : (
                  <p className={styles.noMessage}>No written review</p>
                )}
                <div className={styles.cardMeta}>
                  <span className={styles.name}>{firstName(r.reviewer)}</span>
                  <span className={styles.date}>{formatDate(r.dateReviewed)}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
