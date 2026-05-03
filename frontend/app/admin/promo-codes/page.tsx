'use client';

import { useState, useEffect } from 'react';
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
  maxUsesPerCustomer: number;
  validFrom: string;
  validUntil: string | null;
  active: boolean;
  description: string;
  usageCount: number;
  stripeCouponId: string | null;
};

const EMPTY = {
  code: '',
  type: 'percentage' as const,
  value: 10,
  minOrderValue: 0,
  maxUses: '',
  maxUsesPerCustomer: 1,
  validFrom: new Date().toISOString().split('T')[0],
  validUntil: '',
  description: '',
};

export default function PromoCodesPage() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API}/api/promo-codes`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setCodes(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function set(field: string, value: string | number | boolean) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/promo-codes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...form,
          code: form.code.toUpperCase(),
          maxUses: form.maxUses ? Number(form.maxUses) : null,
          validUntil: form.validUntil || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const created = await res.json();
      setCodes(prev => [created, ...prev]);
      setShowModal(false);
      setForm(EMPTY);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id: string) {
    if (!confirm('Deactivate this promo code? It will also be removed from Stripe.')) return;
    await fetch(`${API}/api/promo-codes/${id}`, { method: 'DELETE', credentials: 'include' });
    setCodes(prev => prev.map(c => c._id === id ? { ...c, active: false } : c));
  }

  async function handleSync(id: string) {
    await fetch(`${API}/api/promo-codes/${id}/sync-stripe`, { method: 'POST', credentials: 'include' });
    const updated = await fetch(`${API}/api/promo-codes`, { credentials: 'include' }).then(r => r.json());
    setCodes(updated);
  }

  function fmtValue(c: PromoCode) {
    return c.type === 'percentage' ? `${c.value}%` : `€${c.value.toFixed(2)}`;
  }

  function fmtDate(d: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return (
    <AdminLayout active="promo-codes">
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Promo Codes</h1>
            <p className={styles.sub}>Codes sync automatically with Stripe Checkout</p>
          </div>
          <button className={styles.newBtn} onClick={() => setShowModal(true)}>+ New code</button>
        </div>

        {loading ? (
          <p className={styles.loading}>Loading…</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Min order</th>
                  <th>Uses</th>
                  <th>Valid until</th>
                  <th>Stripe</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {codes.length === 0 && (
                  <tr><td colSpan={8} className={styles.empty}>No promo codes yet — create one above</td></tr>
                )}
                {codes.map(c => (
                  <tr key={c._id} className={!c.active ? styles.rowInactive : ''}>
                    <td><span className={styles.codeTag}>{c.code}</span></td>
                    <td>{fmtValue(c)}</td>
                    <td>{c.minOrderValue > 0 ? `€${c.minOrderValue}` : '—'}</td>
                    <td>{c.usageCount}{c.maxUses ? ` / ${c.maxUses}` : ''}</td>
                    <td>{fmtDate(c.validUntil)}</td>
                    <td>
                      {c.stripeCouponId
                        ? <span className={styles.badgeOk}>✓ Synced</span>
                        : <button className={styles.syncBtn} onClick={() => handleSync(c._id)}>Sync</button>
                      }
                    </td>
                    <td>
                      <span className={c.active ? styles.badgeActive : styles.badgeOff}>
                        {c.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      {c.active && (
                        <button className={styles.deactivateBtn} onClick={() => handleDeactivate(c._id)}>
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className={styles.overlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>New promo code</h2>
              <button className={styles.modalClose} onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreate} className={styles.form}>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label>Code</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={e => set('code', e.target.value.toUpperCase())}
                    placeholder="SILK10"
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label>Type</label>
                  <select value={form.type} onChange={e => set('type', e.target.value)}>
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed amount (€)</option>
                  </select>
                </div>
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label>Value</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={form.value}
                    onChange={e => set('value', Number(e.target.value))}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label>Min order €  <span className={styles.hint}>(optional)</span></label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.minOrderValue}
                    onChange={e => set('minOrderValue', Number(e.target.value))}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label>Max total uses <span className={styles.hint}>(optional)</span></label>
                  <input
                    type="number"
                    min="1"
                    value={form.maxUses}
                    onChange={e => set('maxUses', e.target.value)}
                    placeholder="Unlimited"
                  />
                </div>
                <div className={styles.field}>
                  <label>Max uses per customer</label>
                  <input
                    type="number"
                    min="1"
                    value={form.maxUsesPerCustomer}
                    onChange={e => set('maxUsesPerCustomer', Number(e.target.value))}
                  />
                </div>
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label>Valid from</label>
                  <input type="date" value={form.validFrom} onChange={e => set('validFrom', e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label>Valid until <span className={styles.hint}>(optional)</span></label>
                  <input type="date" value={form.validUntil} onChange={e => set('validUntil', e.target.value)} />
                </div>
              </div>

              <div className={styles.field}>
                <label>Internal note <span className={styles.hint}>(optional)</span></label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  placeholder="e.g. Welcome discount for new customers"
                />
              </div>

              {error && <p className={styles.errorMsg}>{error}</p>}

              <button type="submit" className={styles.submitBtn} disabled={saving}>
                {saving ? 'Creating…' : 'Create code'}
              </button>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
