'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

// The brand aggregate has ONE owner: GET /api/reviews/summary, which averages
// every APPROVED review at any rating. The homepage reads it, the Organization
// JSON-LD in app/layout.tsx reads it, ProductReviews reads it — and this page
// used to compute its own from whatever the list endpoint happened to return.
//
// Today those two agree by luck: /api/reviews with no query params falls into
// an unpaginated branch and hands back every review, so the local mean matched.
// The luck is one line deep. That branch is guarded by
// `!page && !limit && sort === 'recent' && !productId`, so adding a default
// limit for payload size — with several hundred review bodies going over the
// wire on every visit, someone will — silently turns this page's headline into
// "Based on 10 reviews" and its average into the mean of the ten most recent,
// while the homepage and the structured data keep asserting the real figure.
//
// That divergence is not cosmetic. The same average feeds aggregateRating,
// which is a claim made to Google and, for reviews shown to EU/UK shoppers, a
// regulated statement about what customers said. A page that computes its own
// is a second answer waiting to be different from the first.
type Summary = { average: number; count: number; distribution: Record<string, number> };

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
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<number | null>(null);

  useEffect(() => {
    // The bodies and the figures come from different endpoints on purpose: the
    // list can be sliced without the headline going wrong.
    Promise.all([
      fetch(`${API}/api/reviews`).then(r => r.json()).catch(() => []),
      fetch(`${API}/api/reviews/summary`).then(r => r.json()).catch(() => null),
    ])
      .then(([list, sum]) => {
        setReviews(Array.isArray(list) ? list : []);
        if (sum && typeof sum.average === 'number' && typeof sum.count === 'number') {
          setSummary({ average: sum.average, count: sum.count, distribution: sum.distribution ?? {} });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const total = summary?.count ?? 0;
  const avg = summary?.average ?? 0;
  const dist = summary?.distribution ?? {};

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
                  const count = dist[String(star)] || 0;
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
