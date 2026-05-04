'use client';

import { useState, useEffect } from 'react';
import styles from './ReviewsSection.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Review = {
  _id: string;
  reviewer: string;
  message: string;
  title: string;
  starRating: number;
  dateReviewed: string;
  source: string;
  verified: boolean;
  helpfulCount: number;
};

type Summary = {
  average: number;
  count: number;
  distribution: Record<number, number>;
};

function Stars({ n, small }: { n: number; small?: boolean }) {
  return (
    <span className={small ? styles.starsSmall : styles.stars} aria-label={`${n} out of 5 stars`}>
      {'★'.repeat(n)}{'☆'.repeat(5 - n)}
    </span>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days < 1) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) !== 1 ? 's' : ''} ago`;
  if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) !== 1 ? 's' : ''} ago`;
  return `${Math.floor(days / 365)} year${Math.floor(days / 365) !== 1 ? 's' : ''} ago`;
}

function DistributionBar({ label, count, total }: { label: number; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className={styles.distRow}>
      <span className={styles.distLabel}>{label} ★</span>
      <div className={styles.distBarWrap}>
        <div className={styles.distBar} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.distCount}>{count}</span>
    </div>
  );
}

export default function ReviewsSection() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState('recent');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [voted, setVoted] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch(`${API}/api/reviews/summary`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setSummary(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    setReviews([]);
    loadPage(1, true);
  }, [sort, verifiedOnly]); // eslint-disable-line

  async function loadPage(p: number, replace = false) {
    const params = new URLSearchParams({ sort, page: String(p), limit: '10' });
    if (verifiedOnly) params.set('verified', 'true');
    try {
      const res = await fetch(`${API}/api/reviews?${params}`);
      const data = await res.json();
      const list: Review[] = Array.isArray(data) ? data : (data.reviews ?? []);
      setReviews(prev => replace ? list : [...prev, ...list]);
      setTotalPages(data.pages ?? 1);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  async function loadMore() {
    const next = page + 1;
    setLoadingMore(true);
    setPage(next);
    await loadPage(next, false);
  }

  async function markHelpful(id: string) {
    if (voted.has(id)) return;
    setVoted(prev => new Set([...prev, id]));
    try {
      const res = await fetch(`${API}/api/reviews/${id}/helpful`, { method: 'POST' });
      const data = await res.json();
      setReviews(prev => prev.map(r => r._id === id ? { ...r, helpfulCount: data.helpfulCount } : r));
    } catch {
      setVoted(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  }

  if (!summary || summary.count === 0) return null;

  const total = summary.count;

  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <h2 className={styles.heading}>Customer reviews</h2>

        {/* Summary header */}
        <div className={styles.summaryRow}>
          <div className={styles.summaryLeft}>
            <div className={styles.avgBig}>
              <Stars n={Math.round(summary.average)} />
              <span className={styles.avgNum}>{summary.average.toFixed(1)}</span>
              <span className={styles.avgLabel}>out of 5</span>
            </div>
            <p className={styles.avgSub}>Based on {total} verified Etsy review{total !== 1 ? 's' : ''}</p>
          </div>
          <div className={styles.distribution}>
            {([5, 4, 3, 2, 1] as const).map(n => (
              <DistributionBar key={n} label={n} count={summary.distribution[n] || 0} total={total} />
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className={styles.controls}>
          <div className={styles.sortRow}>
            <label className={styles.controlLabel}>Sort</label>
            <select className={styles.select} value={sort} onChange={e => setSort(e.target.value)}>
              <option value="recent">Most recent</option>
              <option value="highest">Highest rated</option>
              <option value="helpful">Most helpful</option>
            </select>
          </div>
          <label className={styles.checkLabel}>
            <input type="checkbox" checked={verifiedOnly} onChange={e => setVerifiedOnly(e.target.checked)} />
            Verified purchases only
          </label>
        </div>

        {/* Review list */}
        {loading ? (
          <p className={styles.loadingText}>Loading reviews…</p>
        ) : reviews.length === 0 ? (
          <p className={styles.loadingText}>No reviews found.</p>
        ) : (
          <>
            <div className={styles.list}>
              {reviews.map(r => (
                <div key={r._id} className={styles.reviewCard}>
                  <div className={styles.reviewTop}>
                    <Stars n={r.starRating} small />
                    {(r.verified || r.source === 'etsy') && (
                      <span className={styles.verifiedBadge}>
                        {r.source === 'etsy' ? 'Verified Etsy purchase' : 'Verified purchase'}
                      </span>
                    )}
                  </div>
                  {r.title && <p className={styles.reviewTitle}>{r.title}</p>}
                  <p className={styles.reviewBody}>{r.message}</p>
                  <div className={styles.reviewMeta}>
                    <span className={styles.reviewerName}>{r.reviewer.split(' ')[0]}</span>
                    <span className={styles.reviewDate}>{timeAgo(r.dateReviewed)}</span>
                    <button
                      className={`${styles.helpfulBtn} ${voted.has(r._id) ? styles.helpfulVoted : ''}`}
                      onClick={() => markHelpful(r._id)}
                      disabled={voted.has(r._id)}
                    >
                      {voted.has(r._id) ? '✓ Helpful' : 'Helpful'}{r.helpfulCount > 0 ? ` (${r.helpfulCount})` : ''}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {page < totalPages && (
              <button className={styles.loadMore} onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Load more reviews'}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
