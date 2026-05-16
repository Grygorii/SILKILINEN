'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type PromoCode = {
  _id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minOrderValue: number;
  maxUses: number | null;
  validUntil: string | null;
  active: boolean;
  status: string | null;
  description: string;
  usageCount: number;
  redemptionType: string | null;
  stripeCouponId: string | null;
  source: string;
  targetCustomerId: string | null;
  createdAt: string;
};

function isPersonal(c: PromoCode) {
  return !!c.targetCustomerId || (c.source || '').startsWith('customer_');
}

function resolveStatus(c: PromoCode): string {
  if (c.status) return c.status;
  return c.active ? 'active' : 'paused';
}

function fmtDiscount(c: PromoCode) {
  return c.type === 'percentage' ? `${c.value}% off` : `€${c.value.toFixed(2)} off`;
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtUses(c: PromoCode) {
  const cap = c.maxUses ? ` / ${c.maxUses}` : ' / ∞';
  return `${c.usageCount}${cap}`;
}

const STATUSES = ['all', 'active', 'paused', 'expired', 'draft'];
const CODE_TYPES = ['all', 'broad', 'personal'] as const;
type CodeTypeFilter = typeof CODE_TYPES[number];

const pillStyle: Record<string, React.CSSProperties> = {
  active:  { background: '#e8f5e9', color: '#2d7d47' },
  paused:  { background: '#fff8e1', color: '#b07d00' },
  expired: { background: '#f3f3f3', color: '#666' },
  draft:   { background: '#ede7f6', color: '#5c35a8' },
};

export default function PromoCodesPage() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [codeTypeFilter, setCodeTypeFilter] = useState<CodeTypeFilter>('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (search) params.set('search', search);
    try {
      const res = await fetch(`${API}/api/promo-codes?${params}`, { credentials: 'include' });
      const data = await res.json();
      setCodes(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [statusFilter, search]);

  const visibleCodes = codeTypeFilter === 'all' ? codes
    : codeTypeFilter === 'personal' ? codes.filter(isPersonal)
    : codes.filter(c => !isPersonal(c));

  useEffect(() => { load(); }, [load]);

  async function toggleStatus(c: PromoCode) {
    const next = resolveStatus(c) === 'active' ? 'paused' : 'active';
    await fetch(`${API}/api/promo-codes/${c._id}`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next, active: next === 'active' }),
    });
    load();
  }

  async function duplicate(c: PromoCode) {
    const newCode = `${c.code}-COPY`;
    await fetch(`${API}/api/promo-codes`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: newCode, type: c.type, value: c.value,
        minOrderValue: c.minOrderValue, maxUses: c.maxUses,
        description: `Copy of ${c.code}`, status: 'draft',
      }),
    });
    load();
  }

  async function deleteCode(c: PromoCode) {
    if (!confirm(`Deactivate ${c.code}? This will also archive it in Stripe.`)) return;
    await fetch(`${API}/api/promo-codes/${c._id}`, { method: 'DELETE', credentials: 'include' });
    load();
  }

  const thStyle: React.CSSProperties = {
    textAlign: 'left', padding: '8px 12px', fontSize: 10, letterSpacing: '1.2px',
    textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 400,
    borderBottom: '1px solid var(--border)',
  };
  const tdStyle: React.CSSProperties = {
    padding: '12px 12px', borderBottom: '1px solid var(--border)',
    fontSize: 13, color: 'var(--dark)', verticalAlign: 'middle',
  };

  return (
    <AdminLayout>
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Promo codes</h1>
            <p className={styles.sub}>Discount codes synced with Stripe Checkout</p>
          </div>
          <Link href="/admin/promo-codes/new" className={styles.newBtn}>+ New code</Link>
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 2 }}>
            {STATUSES.map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} style={{
                padding: '6px 14px', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
                border: '1px solid var(--border)', letterSpacing: '0.04em',
                background: statusFilter === s ? 'var(--dark)' : 'white',
                color: statusFilter === s ? 'white' : 'var(--muted)',
                textTransform: 'capitalize',
              }}>
                {s}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 2, marginLeft: 8 }}>
            {(['all', 'broad', 'personal'] as const).map(t => (
              <button key={t} onClick={() => setCodeTypeFilter(t)} style={{
                padding: '6px 14px', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
                border: '1px solid var(--border)', letterSpacing: '0.04em',
                background: codeTypeFilter === t ? '#5c35a8' : 'white',
                color: codeTypeFilter === t ? 'white' : 'var(--muted)',
                textTransform: 'capitalize',
              }}>
                {t === 'all' ? 'All codes' : t === 'personal' ? 'Personal only' : 'Broad only'}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value.toUpperCase())}
            placeholder="Search code…"
            style={{
              padding: '6px 12px', border: '1px solid var(--border)', fontFamily: 'inherit',
              fontSize: 13, color: 'var(--dark)', background: 'white', outline: 'none',
            }}
          />
        </div>

        {/* Table */}
        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</p>
        ) : codes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: 'white', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: 16, color: 'var(--muted)', marginBottom: 20, fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
              No promo codes yet
            </p>
            <Link href="/admin/promo-codes/new" className={styles.newBtn}>+ Create your first code</Link>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Code', 'Discount', 'Min order', 'Status', 'Redemptions', 'Expires', 'Stripe', ''].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleCodes.length === 0 && (
                  <tr><td colSpan={8} style={{ ...tdStyle, textAlign: 'center', color: 'var(--muted)', padding: '32px' }}>
                    No codes match these filters.
                  </td></tr>
                )}
                {visibleCodes.map(c => {
                  const st = resolveStatus(c);
                  const personal = isPersonal(c);
                  return (
                    <tr key={c._id} style={{ opacity: st === 'expired' ? 0.6 : 1 }}>
                      <td style={tdStyle}>
                        <Link href={`/admin/promo-codes/${c._id}`} style={{ color: 'var(--dark)', textDecoration: 'none', fontWeight: 500 }}>
                          {c.code}
                        </Link>
                        {personal && (
                          <span style={{ marginLeft: 8, display: 'inline-block', padding: '1px 6px', fontSize: 9, letterSpacing: '0.8px', textTransform: 'uppercase', borderRadius: 2, background: '#ede7f6', color: '#5c35a8' }}>
                            Personal
                          </span>
                        )}
                        {c.description && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{c.description}</div>}
                      </td>
                      <td style={tdStyle}>{fmtDiscount(c)}</td>
                      <td style={tdStyle}>{c.minOrderValue > 0 ? `€${c.minOrderValue}` : '—'}</td>
                      <td style={tdStyle}>
                        <span style={{
                          display: 'inline-block', padding: '2px 8px', fontSize: 10,
                          letterSpacing: '0.8px', textTransform: 'uppercase', borderRadius: 2,
                          ...(pillStyle[st] || pillStyle.draft),
                        }}>
                          {st}
                        </span>
                      </td>
                      <td style={tdStyle}>{fmtUses(c)}</td>
                      <td style={tdStyle}>{fmtDate(c.validUntil)}</td>
                      <td style={tdStyle}>
                        {c.stripeCouponId
                          ? <span style={{ fontSize: 11, color: '#2d7d47' }}>✓ synced</span>
                          : <span style={{ fontSize: 11, color: 'var(--muted)' }}>not synced</span>
                        }
                      </td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                        <Link href={`/admin/promo-codes/${c._id}`} style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none', marginRight: 10 }}>
                          View
                        </Link>
                        {st !== 'expired' && (
                          <button onClick={() => toggleStatus(c)} style={{ fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0, marginRight: 10 }}>
                            {st === 'active' ? 'Pause' : 'Resume'}
                          </button>
                        )}
                        <button onClick={() => duplicate(c)} style={{ fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0, marginRight: 10 }}>
                          Duplicate
                        </button>
                        <button onClick={() => deleteCode(c)} style={{ fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#c0392b', padding: 0 }}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
