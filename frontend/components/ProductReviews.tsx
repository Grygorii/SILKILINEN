'use client';

import { useState, useEffect } from 'react';
import { Star, Check, ThumbsUp, BadgeCheck } from 'lucide-react';
import styles from './ProductReviews.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Review = {
  _id: string;
  reviewer: string;
  title?: string;
  message?: string;
  starRating: number;
  dateReviewed: string;
  helpfulCount?: number;
  verifiedPurchase?: boolean;
  reply?: string;
  repliedAt?: string;
};
type Summary = { average: number; count: number; distribution: Record<string, number> };
type Sort = 'recent' | 'helpful' | 'highest';

const RATING_LABEL = ['', 'Not for me', "It's okay", 'Good', 'Really good', 'I love it'];

// Read-only star row.
function Stars({ value, size = 15 }: { value: number; size?: number }) {
  return (
    <span className={styles.starsRow} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} size={size} strokeWidth={1.5} className={n <= Math.round(value) ? styles.starOn : styles.starOff}
          fill={n <= Math.round(value) ? 'currentColor' : 'none'} aria-hidden="true" />
      ))}
    </span>
  );
}

export default function ProductReviews({ productId, productName }: { productId: string; productName: string }) {
  const [summary, setSummary] = useState<Summary>({ average: 0, count: 0, distribution: {} });
  const [reviews, setReviews] = useState<Review[]>([]);
  const [sort, setSort] = useState<Sort>('recent');
  const [loading, setLoading] = useState(true);
  const [voted, setVoted] = useState<Set<string>>(new Set());

  // Write-tool state
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // honeypot — must stay empty
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [sRes, lRes] = await Promise.all([
          fetch(`${API}/api/reviews/summary?productId=${productId}`),
          fetch(`${API}/api/reviews?productId=${productId}&sort=${sort}&limit=20`),
        ]);
        if (!alive) return;
        if (sRes.ok) setSummary(await sRes.json());
        if (lRes.ok) {
          const d = await lRes.json();
          if (alive) setReviews(Array.isArray(d) ? d : (d.reviews || []));
        }
      } catch { /* noop */ } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [productId, sort]);

  // When someone picks a star from the summary block, open the form on that rating.
  function startReview(stars: number) {
    setRating(stars);
    setOpen(true);
    setTimeout(() => document.getElementById('rv-name')?.focus(), 50);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError('');
    if (!rating) { setError('Please choose a star rating.'); return; }
    if (!name.trim()) { setError('Please add your name.'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewer: name.trim(), title: title.trim(), message: message.trim(), starRating: rating, productId, website }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Could not post your review.');
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post your review.');
    } finally { setSubmitting(false); }
  }

  async function markHelpful(id: string) {
    if (voted.has(id)) return;
    setVoted(prev => new Set(prev).add(id));
    setReviews(prev => prev.map(r => r._id === id ? { ...r, helpfulCount: (r.helpfulCount || 0) + 1 } : r));
    fetch(`${API}/api/reviews/${id}/helpful`, { method: 'POST' }).catch(() => {});
  }

  const shown = hover || rating;
  const { count, average, distribution } = summary;

  return (
    <section className={styles.root} id="reviews">
      <div className={styles.head}>
        <h2 className={styles.title}>Reviews</h2>
        {count > 0 && <Stars value={average} size={18} />}
        {count > 0 && <span className={styles.headCount}>{average.toFixed(1)} · {count} review{count !== 1 ? 's' : ''}</span>}
      </div>

      {/* Summary + invite */}
      <div className={styles.summary}>
        <div className={styles.invite}>
          <p className={styles.inviteTitle}>{count > 0 ? 'Worn it? Share how it feels.' : 'Be the first to review this.'}</p>
          <p className={styles.inviteSub}>Tap a star to start{count > 0 ? '' : ' — it helps others choose'}.</p>
          {/* Tappable stars that open the form on the chosen rating */}
          {!open && !submitted && (
            <div className={styles.invitePicker} role="group" aria-label="Rate this product to start a review">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" className={styles.pickStar} onClick={() => startReview(n)}
                  onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} aria-label={`${n} star${n > 1 ? 's' : ''}`}>
                  <Star size={30} strokeWidth={1.3} fill={n <= hover ? 'currentColor' : 'none'}
                    className={n <= hover ? styles.starOn : styles.starOff} />
                </button>
              ))}
              <span className={styles.pickHint}>{hover ? RATING_LABEL[hover] : ''}</span>
            </div>
          )}
        </div>

        {count > 0 && (
          <div className={styles.bars}>
            {[5, 4, 3, 2, 1].map(n => {
              const c = distribution?.[n] || 0;
              const pct = count ? Math.round((c / count) * 100) : 0;
              return (
                <div key={n} className={styles.barRow}>
                  <span className={styles.barLabel}>{n}<Star size={11} fill="currentColor" strokeWidth={0} /></span>
                  <span className={styles.barTrack}><span className={styles.barFill} style={{ width: `${pct}%` }} /></span>
                  <span className={styles.barCount}>{c}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Write tool */}
      {submitted ? (
        <div className={styles.thanks}>
          <span className={styles.thanksIcon}><Check size={22} strokeWidth={2} /></span>
          <p className={styles.thanksTitle}>Thank you — your review is in.</p>
          <p className={styles.thanksSub}>It’ll appear here once we’ve had a quick look. We read every one.</p>
        </div>
      ) : open ? (
        <form className={styles.form} onSubmit={submit}>
          <p className={styles.formTitle}>Your review of {productName}</p>

          <div className={styles.formStars} role="radiogroup" aria-label="Star rating">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`}
                className={styles.pickStar} onClick={() => setRating(n)}
                onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}>
                <Star size={34} strokeWidth={1.3} fill={n <= shown ? 'currentColor' : 'none'}
                  className={n <= shown ? styles.starOn : styles.starOff} />
              </button>
            ))}
            <span className={styles.pickHint}>{shown ? RATING_LABEL[shown] : 'Tap to rate'}</span>
          </div>

          <div className={styles.fields}>
            <input id="rv-name" className={styles.input} placeholder="Your name" value={name} onChange={e => setName(e.target.value)} maxLength={80} autoComplete="name" />
            <input className={styles.input} placeholder="Sum it up (optional)" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} />
            <textarea className={styles.textarea} placeholder="How does it feel to wear? What did you love?" value={message} onChange={e => setMessage(e.target.value)} maxLength={2000} rows={4} />
            {/* Honeypot — hidden from real users */}
            <input className={styles.hp} tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} aria-hidden="true" />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.formActions}>
            <button type="submit" className={styles.submit} disabled={submitting}>{submitting ? 'Posting…' : 'Post review'}</button>
            <button type="button" className={styles.cancel} onClick={() => setOpen(false)}>Cancel</button>
            <span className={styles.formNote}>No account needed · reviewed before it’s published</span>
          </div>
        </form>
      ) : null}

      {/* List */}
      {count > 0 && (
        <div className={styles.list}>
          <div className={styles.listHead}>
            <span className={styles.listCount}>{count} review{count !== 1 ? 's' : ''}</span>
            <div className={styles.sortRow}>
              {(['recent', 'helpful', 'highest'] as Sort[]).map(s => (
                <button key={s} className={`${styles.sortBtn} ${sort === s ? styles.sortOn : ''}`} onClick={() => setSort(s)}>
                  {s === 'recent' ? 'Most recent' : s === 'helpful' ? 'Most helpful' : 'Highest rated'}
                </button>
              ))}
            </div>
          </div>

          {reviews.map(r => (
            <article key={r._id} className={styles.card}>
              <div className={styles.cardTop}>
                <Stars value={r.starRating} />
                <span className={styles.cardDate}>{new Date(r.dateReviewed).toLocaleDateString('en-IE', { month: 'long', year: 'numeric' })}</span>
              </div>
              {r.title && <p className={styles.cardTitle}>{r.title}</p>}
              {r.message && <p className={styles.cardMsg}>{r.message}</p>}
              {r.reply && (
                <div className={styles.reply}>
                  <p className={styles.replyFrom}>Response from SILKILINEN</p>
                  <p className={styles.replyText}>{r.reply}</p>
                </div>
              )}
              <div className={styles.cardFoot}>
                <span className={styles.cardName}>
                  {r.reviewer}
                  {r.verifiedPurchase && <span className={styles.verified}><BadgeCheck size={13} strokeWidth={2} /> Verified buyer</span>}
                </span>
                <button className={`${styles.helpful} ${voted.has(r._id) ? styles.helpfulOn : ''}`} onClick={() => markHelpful(r._id)} disabled={voted.has(r._id)}>
                  <ThumbsUp size={13} strokeWidth={1.6} /> Helpful{r.helpfulCount ? ` (${r.helpfulCount})` : ''}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {!loading && count === 0 && !open && !submitted && (
        <p className={styles.empty}>No reviews yet — yours could be the first.</p>
      )}
    </section>
  );
}
