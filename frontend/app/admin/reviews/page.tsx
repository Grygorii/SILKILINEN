'use client';

import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import AdminModal from '@/components/AdminModal';
import { toast } from '@/lib/adminToast';
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
  reply?: string;
  repliedAt?: string;
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
  type Diagnostics = {
    totalOrders: number;
    excludedByStatus: number;
    excludedByMissingEmail: number;
    excludedByTooFresh: number;
    excludedByAlreadySent: number;
    excludedByNoItems: number;
  };
  const [result, setResult] = useState<{ eligible: number; sent: number; skipped: number; errors: number; diagnostics?: Diagnostics } | null>(null);
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
      setResult({ eligible: data.eligible, sent: data.sent, skipped: data.skipped, errors: data.errors, diagnostics: data.diagnostics });
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
        <>
          <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--color-ink, #2A2218)' }}>
            Eligible: <strong>{result.eligible}</strong> · Sent: <strong>{result.sent}</strong> · Skipped (no products): <strong>{result.skipped}</strong>
            {result.errors > 0 && <> · Errors: <strong style={{ color: '#c9572a' }}>{result.errors}</strong></>}
          </p>
          {result.diagnostics && result.eligible === 0 && result.diagnostics.totalOrders > 0 && (
            <div style={{ marginTop: 8, padding: 10, background: 'var(--color-bg, #FAF8F4)', border: '1px dashed var(--color-line, #E8E2D6)', borderRadius: 2 }}>
              <p style={{ margin: 0, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--color-ink-muted, #8A8278)' }}>
                Why no orders matched ({result.diagnostics.totalOrders} total)
              </p>
              <ul style={{ margin: '6px 0 0', paddingLeft: 16, fontSize: 12, color: 'var(--color-ink, #2A2218)', lineHeight: 1.7 }}>
                {result.diagnostics.excludedByStatus > 0 && (
                  <li><strong>{result.diagnostics.excludedByStatus}</strong> not in paid/processing/shipped/delivered status</li>
                )}
                {result.diagnostics.excludedByMissingEmail > 0 && (
                  <li><strong>{result.diagnostics.excludedByMissingEmail}</strong> have no customer email on file</li>
                )}
                {result.diagnostics.excludedByTooFresh > 0 && (
                  <li><strong>{result.diagnostics.excludedByTooFresh}</strong> too fresh (younger than {ageDays} {ageDays === 1 ? 'day' : 'days'})</li>
                )}
                {result.diagnostics.excludedByAlreadySent > 0 && (
                  <li><strong>{result.diagnostics.excludedByAlreadySent}</strong> already received a request</li>
                )}
                {result.diagnostics.excludedByNoItems > 0 && (
                  <li><strong>{result.diagnostics.excludedByNoItems}</strong> have no items on the order</li>
                )}
              </ul>
            </div>
          )}
        </>
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
  // Reject flow: modal with an optional reason instead of a prompt().
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
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
      toast(err instanceof Error ? err.message : 'Action failed', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function saveReply(id: string, text: string) {
    setBusyId(id);
    try {
      const res = await fetch(`${API}/api/admin/reviews/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reply', reply: text }),
      });
      if (!res.ok) throw new Error(`Reply failed (${res.status})`);
      toast(text ? 'Reply saved' : 'Reply removed', 'success');
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Reply failed', 'error');
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
      toast(err instanceof Error ? err.message : 'Delete failed', 'error');
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
                      <button className={styles.approve} onClick={() => moderate(r._id, 'approve')} disabled={busyId === r._id}>{busyId === r._id ? '…' : 'Approve'}</button>
                    )}
                    {r.status !== 'rejected' && (
                      <button className={styles.reject} onClick={() => { setRejectReason(''); setRejectId(r._id); }} disabled={busyId === r._id}>Reject</button>
                    )}
                    {r.status !== 'spam' && (
                      <button className={styles.spam} onClick={() => moderate(r._id, 'spam')} disabled={busyId === r._id}>{busyId === r._id ? '…' : 'Spam'}</button>
                    )}
                    <button className={styles.del} onClick={() => remove(r._id)} disabled={busyId === r._id}>{busyId === r._id ? '…' : 'Delete'}</button>
                  </div>
                </div>

                {r.rejectionReason && (
                  <div className={styles.rejectionNote}>Reason: {r.rejectionReason}</div>
                )}

                {/* Public reply — shown under the review on the storefront. */}
                <div style={{ marginTop: 12, borderTop: '1px solid var(--border,#e8e2d6)', paddingTop: 12 }}>
                  <label style={{ display: 'block', fontSize: 11, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--muted,#8a8680)', marginBottom: 6 }}>
                    {r.reply ? 'Your reply (public)' : 'Reply publicly'}
                  </label>
                  <textarea
                    value={replyDrafts[r._id] ?? r.reply ?? ''}
                    onChange={e => setReplyDrafts(d => ({ ...d, [r._id]: e.target.value }))}
                    placeholder="Write a warm reply — it shows as “Response from SILKILINEN” under the review."
                    rows={2}
                    maxLength={1000}
                    style={{ width: '100%', boxSizing: 'border-box', font: 'inherit', fontSize: 13, padding: '8px 10px', border: '1px solid var(--border,#ddd6c8)', background: '#fff', color: 'var(--dark,#2a2218)', resize: 'vertical' }}
                  />
                  <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                    <button
                      onClick={() => saveReply(r._id, (replyDrafts[r._id] ?? r.reply ?? '').trim())}
                      disabled={busyId === r._id || (replyDrafts[r._id] ?? r.reply ?? '') === (r.reply ?? '')}
                      style={{ padding: '7px 16px', background: 'var(--dark,#2a2218)', color: '#faf8f4', border: 'none', cursor: 'pointer', fontSize: 12, letterSpacing: '0.5px' }}
                    >
                      {busyId === r._id ? '…' : r.reply ? 'Update reply' : 'Reply'}
                    </button>
                    {r.reply && (
                      <button
                        onClick={() => { setReplyDrafts(d => ({ ...d, [r._id]: '' })); saveReply(r._id, ''); }}
                        disabled={busyId === r._id}
                        style={{ padding: '7px 14px', background: 'none', border: '1px solid var(--border,#ddd6c8)', color: 'var(--muted,#8a8680)', cursor: 'pointer', fontSize: 12 }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {rejectId && (
        <AdminModal title="Reject review" onClose={() => setRejectId(null)}>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--dark, #2a2218)' }}>
            Reason (optional — kept for your audit trail):
          </label>
          <textarea
            autoFocus
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            rows={3}
            style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #e0d9cc', resize: 'vertical', boxSizing: 'border-box', marginBottom: 16 }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              onClick={() => setRejectId(null)}
              style={{ padding: '8px 14px', fontSize: 13, border: '1px solid #e0d9cc', background: '#fff', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={() => { const id = rejectId; setRejectId(null); moderate(id, 'reject', rejectReason.trim() || undefined); }}
              style={{ padding: '8px 14px', fontSize: 13, border: '1px solid #b03a2e', background: '#b03a2e', color: '#fff', cursor: 'pointer' }}
            >
              Reject review
            </button>
          </div>
        </AdminModal>
      )}
    </AdminLayout>
  );
}
