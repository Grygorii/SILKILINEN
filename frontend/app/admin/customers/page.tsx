'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import layout from '../_components/AdminPage.module.css';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import { toast } from '@/lib/adminToast';
import { api, ApiError } from '@/lib/api';

const API = process.env.NEXT_PUBLIC_API_URL;

type Segment = { slug: string; label: string; color: string; count: number };
type Customer = {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  orderCount: number;
  totalSpend: number;
  lastOrderAt: string | null;
  firstOrderAt: string | null;
  segments: string[];
  marketingConsent: boolean;
  tags: string[];
  gdprDeletedAt: string | null;
  createdAt: string;
  emailVerified?: boolean;
  profileSource?: string;
};

const SEGMENT_COLORS: Record<string, string> = {
  vip: 'var(--admin-info)', repeat: 'var(--color-success)', 'first-time': 'var(--admin-info)',
  'newsletter-only': 'var(--admin-warning)', recent: 'var(--admin-info)', lapsed: 'var(--admin-danger)', 'at-risk': 'var(--admin-danger)',
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtMoney(n: number | null | undefined) {
  if (!n) return '€0.00';
  return `€${n.toFixed(2)}`;
}

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('');
  const [consentFilter, setConsentFilter] = useState('');
  const [recomputing, setRecomputing] = useState(false);
  const [error, setError] = useState('');
  const [pages, setPages] = useState(0);
  const [reconciliation, setReconciliation] = useState({ pending: 0, unresolved: 0 });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const requestNumber = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const sequence = ++requestNumber.current;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (segmentFilter) params.set('segment', segmentFilter);
    if (consentFilter) params.set('consent', consentFilter);
    setError('');
    try {
      const data = await api.get<{ customers: Customer[]; segments: Segment[]; total: number; pages: number; reconciliation?: { pending: number; unresolved: number } }>(`/api/admin/customers?${params}`, { signal: controller.signal });
      if (sequence !== requestNumber.current || controller.signal.aborted) return;
      setCustomers(Array.isArray(data.customers) ? data.customers : []);
      setSegments(Array.isArray(data.segments) ? data.segments : []);
      setTotal(data.total || 0);
      setPages(data.pages || 0);
      setReconciliation(data.reconciliation || { pending: 0, unresolved: 0 });
    } catch (err) {
      if (controller.signal.aborted || sequence !== requestNumber.current) return;
      setError(err instanceof ApiError && err.status === 401 ? 'Your admin session expired. Sign in again.' : 'Could not load customers. Please try again.');
    } finally {
      if (!controller.signal.aborted && sequence === requestNumber.current) setLoading(false);
    }
  }, [page, debouncedSearch, segmentFilter, consentFilter]);

  useEffect(() => { void load(); return () => activeRequest.current?.abort(); }, [load]);

  async function recompute() {
    setRecomputing(true);
    try {
      const data = await api.post<{ busy?: boolean; created?: number; failed?: number; remaining?: number }>('/api/admin/customers/segments/recompute');
      if (data.busy) toast('A customer sync is already running. Refresh shortly.');
      else if (data.failed) toast('Some customer links need another retry; saved orders are unchanged.', 'error');
      else toast(`Customer sync complete. ${data.created || 0} new profile(s); ${data.remaining || 0} orders pending.`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Customer sync failed.', 'error');
    } finally {
      setRecomputing(false);
      void load();
    }
  }

  async function exportCsv() {
    const params = new URLSearchParams();
    if (segmentFilter) params.set('segment', segmentFilter);
    const { downloadBlob } = await import('@/lib/api');
    try {
      await downloadBlob(`/api/admin/customers/export/csv?${params}`, 'customers.csv', { method: 'GET' });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Export failed', 'error');
    }
  }

  const [winbackSending, setWinbackSending] = useState(false);
  async function sendWinback() {
    if (!confirm('Email all at-risk customers a reminder about the existing 10% offer (SILK10)? Customers who already used SILK10 are skipped automatically.')) return;
    setWinbackSending(true);
    try {
      const res = await fetch(`${API}/api/admin/customers/winback`, {
        method: 'POST', credentials: 'include', headers: { 'X-CSRF-Token': '1' },
      });
      const data = await res.json();
      if (res.ok) toast(`Win-back sent to ${data.sent} customer(s). ${data.skipped} skipped (already used SILK10 or no consent).`);
      else toast(data.error || 'Failed to send', 'error');
    } catch {
      toast('Network error', 'error');
    } finally {
      setWinbackSending(false);
    }
  }

  // Map slug → colour from the segments returned by the API (same colours as the sidebar buttons)
  const segColor = (slug: string) =>
    segments.find(s => s.slug === slug)?.color || SEGMENT_COLORS[slug] || 'var(--admin-ink-muted)';

  const hasFilters = Boolean(search || segmentFilter || consentFilter);
  function clearFilters() {
    setSearch('');
    setSegmentFilter('');
    setConsentFilter('');
    setPage(1);
  }

  const thStyle: React.CSSProperties = {
    textAlign: 'left', padding: '8px 12px', fontSize: 10, letterSpacing: '1.2px',
    textTransform: 'uppercase', color: 'var(--admin-ink-muted)', fontWeight: 400,
    borderBottom: '1px solid var(--admin-line)',
  };
  const tdStyle: React.CSSProperties = {
    padding: '10px 12px', borderBottom: '1px solid var(--admin-line)',
    fontSize: 13, color: 'var(--admin-ink)', verticalAlign: 'middle',
  };

  return (
    <AdminLayout>
      <div className={layout.page} style={{ maxWidth: 1200 }}>
        {/* Header */}
        <div className={layout.header}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--admin-ink)', margin: 0 }}>Customers</h1>
            <p style={{ fontSize: 13, color: 'var(--admin-ink-muted)', marginTop: 4 }}>{total} total · includes guest buyers</p>
          </div>
          <div className={layout.headerActions}>
            {segmentFilter === 'at-risk' && (
              <button onClick={sendWinback} disabled={winbackSending} style={{ padding: '8px 14px', fontSize: 12, border: '1px solid var(--admin-danger)', background: 'var(--admin-danger-soft)', cursor: 'pointer', color: 'var(--admin-danger)', fontFamily: 'inherit' }}>
                {winbackSending ? 'Sending…' : 'Send win-back reminder'}
              </button>
            )}
            <Link href="/admin/customers/founder" style={{ padding: '8px 14px', fontSize: 12, border: '1px solid var(--admin-line)', color: 'var(--admin-ink)', textDecoration: 'none' }}>
              Founder view
            </Link>
            <button onClick={exportCsv} style={{ padding: '8px 14px', fontSize: 12, border: '1px solid var(--admin-line)', background: 'var(--admin-surface)', cursor: 'pointer', color: 'var(--admin-ink)', fontFamily: 'inherit' }}>
              Export CSV
            </button>
            <Link href="/admin/customers/new" style={{ padding: '8px 16px', fontSize: 12, background: 'var(--admin-ink)', color: 'var(--admin-surface)', textDecoration: 'none' }}>
              + New customer
            </Link>
          </div>
        </div>

        <div className={layout.twoCol}>
          {/* Segment sidebar */}
          <div className={layout.sidebar}>
            <p style={{ fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--admin-ink-muted)', marginBottom: 8 }}>Segments</p>
            <div className={layout.segmentList} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button onClick={() => { setSegmentFilter(''); setPage(1); }} style={{
                textAlign: 'left', padding: '6px 10px', fontSize: 12, border: '1px solid var(--admin-line)',
                background: !segmentFilter ? 'var(--admin-ink)' : 'var(--admin-surface)', color: !segmentFilter ? 'var(--admin-surface)' : 'var(--admin-ink)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                All customers
              </button>
              {segments.map(seg => (
                <button key={seg.slug} onClick={() => { setSegmentFilter(seg.slug); setPage(1); }} style={{
                  textAlign: 'left', padding: '6px 10px', fontSize: 12, border: '1px solid var(--admin-line)',
                  background: segmentFilter === seg.slug ? seg.color : 'var(--admin-surface)',
                  color: segmentFilter === seg.slug ? 'var(--admin-surface)' : 'var(--admin-ink)',
                  cursor: 'pointer', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between',
                }}>
                  <span>{seg.label}</span>
                  <span style={{ opacity: 0.7 }}>{seg.count}</span>
                </button>
              ))}
            </div>
            <button onClick={recompute} disabled={recomputing} style={{
              marginTop: 12, width: '100%', padding: '6px 10px', fontSize: 11, border: '1px solid var(--admin-line)',
              background: 'var(--admin-surface)', color: 'var(--admin-ink-muted)', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              {recomputing ? 'Syncing…' : 'Sync orders & segments'}
            </button>
          </div>

          {/* Main content */}
          <div className={layout.main}>
            {(reconciliation.pending > 0 || reconciliation.unresolved > 0) && (
              <p role="status" style={{ fontSize: 13, color: 'var(--admin-ink-muted)', marginBottom: 16 }}>
                {reconciliation.pending > 0 && `${reconciliation.pending} order(s) awaiting customer sync. `}
                {reconciliation.unresolved > 0 && `${reconciliation.unresolved} order(s) need a valid buyer email or a corrected customer link. `}
                <Link href="/admin/orders">Review orders</Link>
              </p>
            )}
            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search name or email…"
                style={{ padding: '6px 12px', border: '1px solid var(--admin-line)', fontFamily: 'inherit', fontSize: 13, color: 'var(--admin-ink)', background: 'var(--admin-surface)', outline: 'none', flex: 1, minWidth: 200 }}
              />
              <select value={consentFilter} onChange={e => { setConsentFilter(e.target.value); setPage(1); }} style={{ padding: '6px 10px', border: '1px solid var(--admin-line)', fontFamily: 'inherit', fontSize: 13, color: 'var(--admin-ink)', background: 'var(--admin-surface)' }}>
                <option value="">All consent</option>
                <option value="yes">Marketing opt-in</option>
              </select>
            </div>

            {/* Table */}
            {loading ? (
              <p style={{ fontSize: 13, color: 'var(--admin-ink-muted)' }}>Loading customers…</p>
            ) : error ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--admin-surface)', border: '1px solid var(--admin-line)' }}>
                <p style={{ fontSize: 14, color: 'var(--admin-ink-muted)' }}>{error}{' '}
                  <button onClick={load} style={{ cursor: 'pointer', textDecoration: 'underline', background: 'none', border: 'none', font: 'inherit', color: 'inherit' }}>Retry</button>
                </p>
              </div>
            ) : customers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--admin-surface)', border: '1px solid var(--admin-line)' }}>
                <p style={{ fontSize: 14, color: 'var(--admin-ink-muted)', margin: 0 }}>
                  {hasFilters ? 'No customers match' : 'No customers yet'}
                </p>
                {hasFilters && (
                  <button onClick={clearFilters} style={{ marginTop: 12, padding: '7px 14px', fontSize: 12, border: '1px solid var(--admin-line)', background: 'var(--admin-surface)', cursor: 'pointer', color: 'var(--admin-ink)', fontFamily: 'inherit' }}>
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className={layout.tableScroll} style={{ background: 'var(--admin-surface)', border: '1px solid var(--admin-line)' }}>
                  {/* minWidth, not just width:100% — inside an overflow-x
                      container a 100%-width table SQUEEZES to the viewport
                      instead of scrolling, which is what clipped the email
                      column on a phone rather than letting it scroll into view. */}
                  <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>
                        {['Customer', 'Segments', 'Orders', 'Net spend (EUR)', 'Last order', 'Consent', ''].map(h => (
                          <th key={h} style={thStyle}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map(c => (
                        <tr
                          key={c._id}
                          onClick={() => router.push(`/admin/customers/${c._id}`)}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--admin-bg)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = ''; }}
                          style={{ cursor: 'pointer' }}
                        >
                          <td style={tdStyle}>
                            <Link href={`/admin/customers/${c._id}`} onClick={e => e.stopPropagation()} style={{ color: 'var(--admin-ink)', textDecoration: 'none', fontWeight: 500 }}>
                              {c.firstName || c.lastName ? `${c.firstName} ${c.lastName}`.trim() : c.email}
                            </Link>
                            <div style={{ fontSize: 11, color: 'var(--admin-ink-muted)', marginTop: 1 }}>{c.email}</div>
                            <div style={{ fontSize: 11, color: 'var(--admin-ink-muted)', marginTop: 2 }}>{c.emailVerified ? 'Email verified' : c.profileSource === 'order' ? 'Guest buyer · email not verified' : 'Contact · email not verified'}</div>
                          </td>
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {(c.segments || []).map(s => (
                                <span key={s} style={{
                                  fontSize: 10, padding: '2px 8px', borderRadius: 9, letterSpacing: '0.6px',
                                  textTransform: 'uppercase', background: segColor(s), color: 'var(--admin-surface)',
                                }}>
                                  {s}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td style={tdStyle}>{c.orderCount || 0}</td>
                          <td style={tdStyle}>{fmtMoney(c.totalSpend)}</td>
                          <td style={tdStyle}>{fmtDate(c.lastOrderAt)}</td>
                          <td style={tdStyle}>
                            <span style={{ fontSize: 11, color: c.marketingConsent ? 'var(--color-success)' : 'var(--admin-ink-muted)' }}>
                              {c.marketingConsent ? '✓ yes' : '—'}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                            <Link href={`/admin/customers/${c._id}`} onClick={e => e.stopPropagation()} style={{ fontSize: 12, color: 'var(--admin-ink-muted)', textDecoration: 'none' }}>
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {total > 50 && (
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '6px 12px', border: '1px solid var(--admin-line)', background: 'var(--admin-surface)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>← Prev</button>
                    <span style={{ padding: '6px 12px', fontSize: 12, color: 'var(--admin-ink-muted)' }}>Page {page} of {pages}</span>
                    <button onClick={() => setPage(p => p + 1)} disabled={page >= pages} style={{ padding: '6px 12px', border: '1px solid var(--admin-line)', background: 'var(--admin-surface)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>Next →</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
