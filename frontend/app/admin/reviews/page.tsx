'use client';

import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Status = 'pending' | 'approved' | 'rejected' | 'spam' | 'all';

type ProductRef = { _id: string; name: string; slug?: string; images?: { url: string; isPrimary?: boolean }[] };

type Review = {
  _id: string;
  reviewer: string;
  title: string;
  message: string;
  starRating: number;
  status: Exclude<Status, 'all'>;
  flagReasons: string[];
  flagLabels: string[];
  source: string;
  dateReviewed: string;
  createdAt: string;
  productId: ProductRef | string | null;
  verifiedPurchase: boolean;
  rejectionReason?: string;
};

type TabCounts = { pending: number; approved: number; rejected: number; spam: number };

const TABS: { key: Status; label: string }[] = [
  { key: 'pending',  label: 'Pending'  },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'spam',     label: 'Spam'     },
  { key: 'all',      label: 'All'      },
];

function Stars({ n }: { n: number }) {
  return <span aria-label={`${n} of 5 stars`}>{'★'.repeat(n)}{'☆'.repeat(5 - n)}</span>;
}

function ReviewRequestTrigger({ onSent }: { onSent: () => void }) {
  const [busy, setBusy] = useState(false);
  // Days since order required before an order is eligible. 14 is the
  // sensible default for production (gives the customer time to actually
  // try the silk). Drop to 0 to test on a fresh order.
  const [ageDays, setAgeDays] = useState(14);
  const [result, setResult] = useState<{ eligible: number; sent: number; skipped: number; errors: number } | null>(null);
  const [err, setErr] = useState('');

  async function run(dryRun: boolean) {
    setBusy(true);
    setErr('');
    setResult(null);
    try {
      const res = await fetch(`${API}/api/admin/reviews/send-pending-requests`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun, ageDays }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      setResult({ eligible: data.eligible, sent: data.sent, skipped: data.skipped, errors: data.errors });
      if (!dryRun && data.sent > 0) onSent();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 16, padding: 16, border: '1px solid var(--color-line, #E8E2D6)', borderRadius: 2, background: 'var(--color-surface, #F5F0E8)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: 0, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 18 }}>Review requests</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-ink-muted, #8A8278)' }}>
            Send a tokenised &ldquo;how was it?&rdquo; email to every order at least
            <em style={{ fontStyle: 'normal', fontWeight: 500 }}> {ageDays} {ageDays === 1 ? 'day' : 'days'} </em>
            old that hasn&rsquo;t received one yet.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--color-ink-muted, #8A8278)' }}>
            Days
            <input
              type="number"
              min={0}
              max={365}
              step={1}
              value={ageDays}
              onChange={e => setAgeDays(Math.max(0, Math.min(365, parseInt(e.target.value, 10) || 0)))}
              style={{
                width: 60, height: 32, padding: '0 8px',
                border: '1px solid var(--color-line, #E8E2D6)', background: 'var(--color-bg, #FAF8F4)',
                borderRadius: 2, fontFamily: 'Jost, sans-serif', fontSize: 13, color: 'var(--color-ink, #2A2218)',
              }}
            />
          </label>
          <button onClick={() => run(true)} disabled={busy}
            style={{ padding: '8px 16px', fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', border: '1px solid var(--color-line, #E8E2D6)', background: 'transparent', cursor: 'pointer', borderRadius: 2 }}>
            {busy ? 'Checking…' : 'Dry run'}
          </button>
          <button onClick={() => run(false)} disabled={busy}
            style={{ padding: '8px 16px', fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', border: '1px solid var(--color-ink, #2A2218)', background: 'var(--color-ink, #2A2218)', color: 'var(--color-bg, #FAF8F4)', cursor: 'pointer', borderRadius: 2 }}>
            {busy ? 'Sending…' : 'Send now'}
          </button>
        </div>
      </div>
      {result && (
        <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--color-ink, #2A2218)' }}>
          Eligible: <strong>{result.eligible}</strong> · Sent: <strong>{result.sent}</strong> · Skipped (no products): <strong>{result.skipped}</strong>
          {result.errors > 0 && <> · Errors: <strong style={{ color: '#c9572a' }}>{result.errors}</strong></>}
        </p>
      )}
      {ageDays < 7 && (
        <p style={{ margin: '8px 0 0', fontSize: 11, color: '#c9572a' }}>
          Low age threshold — useful for testing, but customers usually need ≥7 days to have actually tried the product.
        </p>
      )}
      {err && <p style={{ margin: '12px 0 0', fontSize: 12, color: '#c9572a' }}>{err}</p>}
    </div>
  );
}

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}

export default function ReviewsModeration() {
  const [status, setStatus] = useState<Status>('pending');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [tabCounts, setTabCounts] = useState<TabCounts>({ pending: 0, approved: 0, rejected: 0, spam: 0 });
  const [q, setQ] = useState('');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ status });
      if (q.trim()) params.set('q', q.trim());
      if (flaggedOnly) params.set('flagged', 'true');
      const res = await fetch(`${API}/api/admin/reviews?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      const data = await res.json();
      setReviews(data.reviews || []);
      setTabCounts(data.tabCounts || { pending: 0, approved: 0, rejected: 0, spam: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [status, q, flaggedOnly]);

  useEffect(() => { load(); }, [load]);

  async function moderate(id: string, action: 'approve' | 'reject' | 'spam', reason?: string) {
    setBusyId(id);
    try {
      const res = await fetch(`${API}/api/admin/reviews/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      });
      if (!res.ok) throw new Error(`Action failed (${res.status})`);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm('Permanently delete this review? Normal flow is reject/spam, which keeps the row for audit.')) return;
    setBusyId(id);
    try {
      const res = await fetch(`${API}/api/admin/reviews/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusyId(null);
    }
  }

  function productLabel(p: Review['productId']): { name: string; thumb?: string } | null {
    if (!p || typeof p === 'string') return null;
    const primary = (p.images || []).find(img => img.isPrimary) || (p.images || [])[0];
    return { name: p.name, thumb: primary?.url };
  }

  return (
    <AdminLayout active="reviews">
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>Reviews</h1>
          <p className={styles.sub}>Approve, reject, or mark as spam. New customer submissions arrive in Pending.</p>
          <ReviewRequestTrigger onSent={load} />
        </header>

        <div className={styles.tabs}>
          {TABS.map(t => (
            <button
              key={t.key}
              className={`${styles.tab} ${status === t.key ? styles.tabActive : ''}`}
              onClick={() => setStatus(t.key)}
            >
              {t.label}
              {t.key !== 'all' && tabCounts[t.key] > 0 && (
                <span className={styles.count}>{tabCounts[t.key]}</span>
              )}
            </button>
          ))}
        </div>

        <div className={styles.filters}>
          <input
            className={styles.input}
            placeholder="Search reviewer, title, message…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={flaggedOnly}
              onChange={e => setFlaggedOnly(e.target.checked)}
            />
            Flagged only
          </label>
        </div>

        {error && <div className={styles.error}>{error}</div>}
        {loading && <div className={styles.loading}>Loading…</div>}

        {!loading && reviews.length === 0 && (
          <div className={styles.empty}>No reviews match the current filter.</div>
        )}

        <ul className={styles.list}>
          {reviews.map(r => {
            const prod = productLabel(r.productId);
            return (
              <li key={r._id} className={styles.card}>
                <div className={styles.cardHead}>
                  <div className={styles.who}>
                    <span className={styles.reviewer}>{r.reviewer || 'Anonymous'}</span>
                    {r.verifiedPurchase && <span className={styles.verifiedBadge}>verified buyer</span>}
                    <span className={styles.source}>{r.source}</span>
                  </div>
                  <div className={styles.meta}>
                    <span className={styles.stars}><Stars n={r.starRating} /></span>
                    <span className={styles.date}>{formatDate(r.dateReviewed || r.createdAt)}</span>
                  </div>
                </div>

                {r.title && <p className={styles.reviewTitle}>{r.title}</p>}
                {r.message && <p className={styles.message}>{r.message}</p>}

                <div className={styles.cardFoot}>
                  {prod ? (
                    <a
                      href={`/admin/products/${typeof r.productId === 'object' && r.productId ? r.productId._id : ''}`}
                      className={styles.productChip}
                    >
                      {prod.thumb && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={prod.thumb} alt="" />
                      )}
                      <span>{prod.name}</span>
                    </a>
                  ) : (
                    <span className={styles.noProduct}>No product linked</span>
                  )}

                  {r.flagLabels && r.flagLabels.length > 0 && (
                    <div className={styles.flags}>
                      {r.flagLabels.map((label, i) => (
                        <span key={i} className={styles.flag}>{label}</span>
                      ))}
                    </div>
                  )}

                  <div className={styles.actions}>
                    {r.status !== 'approved' && (
                      <button className={styles.approve} onClick={() => moderate(r._id, 'approve')} disabled={busyId === r._id}>Approve</button>
                    )}
                    {r.status !== 'rejected' && (
                      <button className={styles.reject} onClick={() => {
                        const reason = prompt('Reason for rejection (optional):') ?? undefined;
                        moderate(r._id, 'reject', reason);
                      }} disabled={busyId === r._id}>Reject</button>
                    )}
                    {r.status !== 'spam' && (
                      <button className={styles.spam} onClick={() => moderate(r._id, 'spam')} disabled={busyId === r._id}>Spam</button>
                    )}
                    <button className={styles.del} onClick={() => remove(r._id)} disabled={busyId === r._id}>Delete</button>
                  </div>
                </div>

                {r.rejectionReason && (
                  <div className={styles.rejectionNote}>Reason: {r.rejectionReason}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </AdminLayout>
  );
}
