'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import { toast } from '@/lib/adminToast';

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
};

const SEGMENT_COLORS: Record<string, string> = {
  vip: '#5c35a8', repeat: '#2d7d47', 'first-time': '#1565c0',
  'newsletter-only': '#b07d00', recent: '#00838f', lapsed: '#e65100', 'at-risk': '#c62828',
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtMoney(n: number | null | undefined) {
  if (!n) return '€0';
  return `€${n.toFixed(2)}`;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('');
  const [consentFilter, setConsentFilter] = useState('');
  const [recomputing, setRecomputing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (search) params.set('search', search);
    if (segmentFilter) params.set('segment', segmentFilter);
    if (consentFilter) params.set('consent', consentFilter);
    setError(false);
    try {
      const res = await fetch(`${API}/api/admin/customers?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setCustomers(Array.isArray(data.customers) ? data.customers : []);
      setSegments(Array.isArray(data.segments) ? data.segments : []);
      setTotal(data.total || 0);
    } catch { setError(true); }
    setLoading(false);
  }, [page, search, segmentFilter, consentFilter]);

  useEffect(() => { load(); }, [load]);

  async function recompute() {
    setRecomputing(true);
    try {
      const res = await fetch(`${API}/api/admin/customers/segments/recompute`, { method: 'POST', credentials: 'include' });
      if (res.ok) toast('Segments recomputed.');
      else toast('Recompute failed.', 'error');
    } catch {
      toast('Network error.', 'error');
    } finally {
      setRecomputing(false);
    }
    load();
  }

  async function exportCsv() {
    const params = new URLSearchParams();
    if (segmentFilter) params.set('segment', segmentFilter);
    const { downloadBlob } = await import('@/lib/api');
    try {
      await downloadBlob(`/api/admin/customers/export/csv?${params}`, 'customers.csv');
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

  const thStyle: React.CSSProperties = {
    textAlign: 'left', padding: '8px 12px', fontSize: 10, letterSpacing: '1.2px',
    textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 400,
    borderBottom: '1px solid var(--border)',
  };
  const tdStyle: React.CSSProperties = {
    padding: '10px 12px', borderBottom: '1px solid var(--border)',
    fontSize: 13, color: 'var(--dark)', verticalAlign: 'middle',
  };

  return (
    <AdminLayout>
      <div style={{ padding: '24px 28px', maxWidth: 1200 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--dark)', margin: 0 }}>Customers</h1>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{total} total</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {segmentFilter === 'at-risk' && (
              <button onClick={sendWinback} disabled={winbackSending} style={{ padding: '8px 14px', fontSize: 12, border: '1px solid #c62828', background: '#fff5f5', cursor: 'pointer', color: '#c62828', fontFamily: 'inherit' }}>
                {winbackSending ? 'Sending…' : 'Send win-back reminder'}
              </button>
            )}
            <Link href="/admin/customers/founder" style={{ padding: '8px 14px', fontSize: 12, border: '1px solid var(--border)', color: 'var(--dark)', textDecoration: 'none' }}>
              Founder view
            </Link>
            <button onClick={exportCsv} style={{ padding: '8px 14px', fontSize: 12, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', color: 'var(--dark)', fontFamily: 'inherit' }}>
              Export CSV
            </button>
            <Link href="/admin/customers/new" style={{ padding: '8px 16px', fontSize: 12, background: 'var(--dark)', color: 'white', textDecoration: 'none' }}>
              + New customer
            </Link>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 20 }}>
          {/* Segment sidebar */}
          <div style={{ width: 180, flexShrink: 0 }}>
            <p style={{ fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Segments</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button onClick={() => { setSegmentFilter(''); setPage(1); }} style={{
                textAlign: 'left', padding: '6px 10px', fontSize: 12, border: '1px solid var(--border)',
                background: !segmentFilter ? 'var(--dark)' : 'white', color: !segmentFilter ? 'white' : 'var(--dark)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                All customers
              </button>
              {segments.map(seg => (
                <button key={seg.slug} onClick={() => { setSegmentFilter(seg.slug); setPage(1); }} style={{
                  textAlign: 'left', padding: '6px 10px', fontSize: 12, border: '1px solid var(--border)',
                  background: segmentFilter === seg.slug ? seg.color : 'white',
                  color: segmentFilter === seg.slug ? 'white' : 'var(--dark)',
                  cursor: 'pointer', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between',
                }}>
                  <span>{seg.label}</span>
                  <span style={{ opacity: 0.7 }}>{seg.count}</span>
                </button>
              ))}
            </div>
            <button onClick={recompute} disabled={recomputing} style={{
              marginTop: 12, width: '100%', padding: '6px 10px', fontSize: 11, border: '1px solid var(--border)',
              background: 'white', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              {recomputing ? 'Recomputing…' : 'Recompute now'}
            </button>
          </div>

          {/* Main content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search name or email…"
                style={{ padding: '6px 12px', border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 13, color: 'var(--dark)', background: 'white', outline: 'none', flex: 1, minWidth: 200 }}
              />
              <select value={consentFilter} onChange={e => { setConsentFilter(e.target.value); setPage(1); }} style={{ padding: '6px 10px', border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 13, color: 'var(--dark)', background: 'white' }}>
                <option value="">All consent</option>
                <option value="yes">Marketing opt-in</option>
              </select>
            </div>

            {/* Table */}
            {loading ? (
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</p>
            ) : error ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: 'white', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: 14, color: 'var(--muted)' }}>Couldn&apos;t load customers.{' '}
                  <button onClick={load} style={{ cursor: 'pointer', textDecoration: 'underline', background: 'none', border: 'none', font: 'inherit', color: 'inherit' }}>Retry</button>
                </p>
              </div>
            ) : customers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: 'white', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: 14, color: 'var(--muted)' }}>No customers found</p>
              </div>
            ) : (
              <>
                <div style={{ overflowX: 'auto', background: 'white', border: '1px solid var(--border)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>
                        {['Customer', 'Segments', 'Orders', 'Spend', 'Last order', 'Consent', ''].map(h => (
                          <th key={h} style={thStyle}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map(c => (
                        <tr key={c._id}>
                          <td style={tdStyle}>
                            <Link href={`/admin/customers/${c._id}`} style={{ color: 'var(--dark)', textDecoration: 'none', fontWeight: 500 }}>
                              {c.firstName || c.lastName ? `${c.firstName} ${c.lastName}`.trim() : c.email}
                            </Link>
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{c.email}</div>
                          </td>
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {(c.segments || []).map(s => (
                                <span key={s} style={{
                                  fontSize: 9, padding: '1px 5px', borderRadius: 2, letterSpacing: '0.6px',
                                  textTransform: 'uppercase', background: SEGMENT_COLORS[s] || '#eee', color: 'white',
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
                            <span style={{ fontSize: 11, color: c.marketingConsent ? '#2d7d47' : 'var(--muted)' }}>
                              {c.marketingConsent ? '✓ yes' : '—'}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                            <Link href={`/admin/customers/${c._id}`} style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none' }}>
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
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '6px 12px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>← Prev</button>
                    <span style={{ padding: '6px 12px', fontSize: 12, color: 'var(--muted)' }}>Page {page}</span>
                    <button onClick={() => setPage(p => p + 1)} disabled={customers.length < 50} style={{ padding: '6px 12px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>Next →</button>
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
