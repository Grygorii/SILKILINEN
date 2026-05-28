'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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

type Tab = 'active' | 'used' | 'archive' | 'all';
type BulkAction = 'archive' | 'restore' | 'pause' | 'resume';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'active',  label: 'Active' },
  { key: 'used',    label: 'Used' },
  { key: 'archive', label: 'Archive' },
  { key: 'all',     label: 'All' },
];

const CODE_TYPES = ['all', 'broad', 'personal'] as const;
type CodeTypeFilter = typeof CODE_TYPES[number];

const pillStyle: Record<string, React.CSSProperties> = {
  active:   { background: '#e8f5e9', color: '#2d7d47' },
  paused:   { background: '#fff8e1', color: '#b07d00' },
  expired:  { background: '#f3f3f3', color: '#666' },
  draft:    { background: '#ede7f6', color: '#5c35a8' },
  archived: { background: '#eceae5', color: '#777' },
};

export default function PromoCodesPage() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('active');
  const [codeTypeFilter, setCodeTypeFilter] = useState<CodeTypeFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkInFlight, setBulkInFlight] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ action: BulkAction; ids: string[] } | null>(null);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('tab', tab);
    if (search) params.set('search', search);
    try {
      const res = await fetch(`${API}/api/promo-codes?${params}`, { credentials: 'include' });
      const data = await res.json();
      setCodes(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [tab, search]);

  const visibleCodes = codeTypeFilter === 'all' ? codes
    : codeTypeFilter === 'personal' ? codes.filter(isPersonal)
    : codes.filter(c => !isPersonal(c));

  useEffect(() => { load(); }, [load]);

  // Clear selection when the user changes tab — bulk actions are inherently tab-scoped.
  useEffect(() => { setSelectedIds(new Set()); }, [tab]);

  // Master-checkbox indeterminate state: some-but-not-all visible rows selected.
  useEffect(() => {
    if (!headerCheckboxRef.current) return;
    const visibleCount = visibleCodes.length;
    const selectedVisible = visibleCodes.filter(c => selectedIds.has(c._id)).length;
    headerCheckboxRef.current.indeterminate = selectedVisible > 0 && selectedVisible < visibleCount;
  }, [visibleCodes, selectedIds]);

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const allVisibleSelected = visibleCodes.length > 0 && visibleCodes.every(c => selectedIds.has(c._id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      for (const c of visibleCodes) {
        if (allVisibleSelected) next.delete(c._id);
        else next.add(c._id);
      }
      return next;
    });
  }

  async function runBulk(action: BulkAction, ids: string[]) {
    if (ids.length === 0) return;
    setBulkInFlight(true);
    const verb = action[0].toUpperCase() + action.slice(1);
    setBulkMessage(`${verb.replace(/e$/, '')}ing ${ids.length} code${ids.length === 1 ? '' : 's'}…`);
    try {
      const res = await fetch(`${API}/api/promo-codes/bulk`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids }),
      });
      const data = await res.json();
      const ok = (data.succeeded || []).length;
      const failed = (data.failed || []).length;
      setBulkMessage(failed ? `${ok} done, ${failed} skipped` : `${ok} ${action}d`);
      await load();
      setTimeout(() => {
        setBulkMessage(null);
        setSelectedIds(new Set());
      }, 2500);
    } catch {
      setBulkMessage('Action failed');
      setTimeout(() => {
        setBulkMessage(null);
        setSelectedIds(new Set());
      }, 2500);
    }
    setBulkInFlight(false);
  }

  function exportCsv(ids: string[]) {
    if (ids.length === 0) return;
    const qs = encodeURIComponent(ids.join(','));
    window.open(`${API}/api/promo-codes/export?ids=${qs}`, '_blank');
  }

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

  async function archiveRow(c: PromoCode) {
    if (!confirm(`Archive ${c.code}? It can be restored from the Archive tab.`)) return;
    await fetch(`${API}/api/promo-codes/${c._id}`, { method: 'DELETE', credentials: 'include' });
    load();
  }

  const selectedCount = selectedIds.size;
  const selectedArray = Array.from(selectedIds);
  const selectedCodes = codes.filter(c => selectedIds.has(c._id));
  const hasActiveSelected = selectedCodes.some(c => resolveStatus(c) === 'active');
  const hasPausedSelected = selectedCodes.some(c => resolveStatus(c) === 'paused');

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
      <div className={`${styles.page} ${selectedCount > 0 ? styles.pageWithBar : ''}`}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Promo codes</h1>
            <p className={styles.sub}>Discount codes synced with Stripe Checkout</p>
          </div>
          <Link href="/admin/promo-codes/new" className={styles.newBtn}>+ New code</Link>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {TABS.map(t => (
            <button
              key={t.key}
              className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Secondary filters: code type + search */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 2 }}>
            {CODE_TYPES.map(t => (
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
              {tab === 'archive' ? 'No archived codes yet' : 'No promo codes yet'}
            </p>
            {tab !== 'archive' && (
              <Link href="/admin/promo-codes/new" className={styles.newBtn}>+ Create your first code</Link>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th className={styles.checkboxCell} style={thStyle}>
                    <input
                      type="checkbox"
                      ref={headerCheckboxRef}
                      className={styles.checkbox}
                      checked={visibleCodes.length > 0 && visibleCodes.every(c => selectedIds.has(c._id))}
                      onChange={toggleSelectAll}
                      aria-label="Select all visible"
                    />
                  </th>
                  {['Code', 'Discount', 'Min order', 'Status', 'Redemptions', 'Expires', 'Stripe', ''].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleCodes.length === 0 && (
                  <tr><td colSpan={9} style={{ ...tdStyle, textAlign: 'center', color: 'var(--muted)', padding: '32px' }}>
                    No codes match these filters.
                  </td></tr>
                )}
                {visibleCodes.map(c => {
                  const st = resolveStatus(c);
                  const personal = isPersonal(c);
                  const selected = selectedIds.has(c._id);
                  return (
                    <tr
                      key={c._id}
                      className={selected ? styles.rowSelected : ''}
                      style={{ opacity: st === 'expired' || st === 'archived' ? 0.6 : 1 }}
                    >
                      <td className={styles.checkboxCell} style={tdStyle}>
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          checked={selected}
                          onChange={() => toggleSelect(c._id)}
                          aria-label={`Select ${c.code}`}
                        />
                      </td>
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
                        {st !== 'expired' && st !== 'archived' && (
                          <button onClick={() => toggleStatus(c)} style={{ fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0, marginRight: 10 }}>
                            {st === 'active' ? 'Pause' : 'Resume'}
                          </button>
                        )}
                        <button onClick={() => duplicate(c)} style={{ fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0, marginRight: 10 }}>
                          Duplicate
                        </button>
                        {st !== 'archived' && (
                          <button onClick={() => archiveRow(c)} style={{ fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#c0392b', padding: 0 }}>
                            Archive
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Bulk action bar (bottom-fixed) */}
        {selectedCount > 0 && (
          <div className={styles.bulkBar}>
            <span className={styles.bulkCount}>{selectedCount} selected</span>
            {bulkMessage && <span className={styles.bulkMessage}>{bulkMessage}</span>}

            {tab === 'archive' ? (
              <button
                className={styles.bulkBtn}
                disabled={bulkInFlight}
                onClick={() => setConfirmDialog({ action: 'restore', ids: selectedArray })}
              >
                Restore
              </button>
            ) : (
              <button
                className={`${styles.bulkBtn} ${styles.bulkBtnDanger}`}
                disabled={bulkInFlight}
                onClick={() => setConfirmDialog({ action: 'archive', ids: selectedArray })}
              >
                Archive
              </button>
            )}

            {tab === 'active' && (
              <>
                <button
                  className={styles.bulkBtn}
                  disabled={bulkInFlight || !hasActiveSelected}
                  onClick={() => runBulk('pause', selectedArray)}
                >
                  Pause
                </button>
                <button
                  className={styles.bulkBtn}
                  disabled={bulkInFlight || !hasPausedSelected}
                  onClick={() => runBulk('resume', selectedArray)}
                >
                  Resume
                </button>
              </>
            )}

            <button
              className={styles.bulkBtn}
              disabled={bulkInFlight}
              onClick={() => exportCsv(selectedArray)}
            >
              Export CSV
            </button>

            <button
              className={styles.bulkClear}
              aria-label="Clear selection"
              onClick={() => setSelectedIds(new Set())}
            >
              ×
            </button>
          </div>
        )}

        {/* Confirmation modal (Archive / Restore) */}
        {confirmDialog && (
          <div className={styles.overlay} onClick={() => setConfirmDialog(null)}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h2>{confirmDialog.action === 'archive' ? 'Archive codes?' : 'Restore codes?'}</h2>
                <button className={styles.modalClose} onClick={() => setConfirmDialog(null)}>×</button>
              </div>
              <div className={styles.confirmBody}>
                {confirmDialog.action === 'archive'
                  ? `Archive ${confirmDialog.ids.length} code${confirmDialog.ids.length === 1 ? '' : 's'}? They can be restored from the Archive tab.`
                  : `Restore ${confirmDialog.ids.length} code${confirmDialog.ids.length === 1 ? '' : 's'}? They'll return to Active status. Stripe coupons may need re-syncing on each code's detail page.`}
              </div>
              <div className={styles.confirmActions}>
                <button className={styles.confirmCancel} onClick={() => setConfirmDialog(null)}>Cancel</button>
                <button
                  className={styles.confirmConfirm}
                  onClick={() => {
                    const c = confirmDialog;
                    setConfirmDialog(null);
                    runBulk(c.action, c.ids);
                  }}
                >
                  {confirmDialog.action === 'archive' ? 'Archive' : 'Restore'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
