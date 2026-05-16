'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';

const API = process.env.NEXT_PUBLIC_API_URL;

type Redemption = {
  _id: string; orderNumber: string; orderId: string;
  customerEmail: string; discountAmount: number; redeemedAt: string; orderStatus?: string;
};

type PromoCode = {
  _id: string; code: string; type: 'percentage' | 'fixed'; value: number;
  minOrderValue: number; maxUses: number | null; maxUsesPerCustomer: number;
  validFrom: string; validUntil: string | null;
  active: boolean; status: string | null; description: string;
  usageCount: number; redemptionType: string | null;
  appliesTo: string; source: string;
  stripeCouponId: string | null; createdAt: string;
  performance: {
    totalRedemptions: number; totalDiscountGiven: number;
    totalRevenue: number; avgOrderValue: number | null;
  };
  redemptions: Redemption[];
};

function resolveStatus(c: PromoCode): string {
  return c.status || (c.active ? 'active' : 'paused');
}

const inputStyle: React.CSSProperties = {
  padding: '9px 12px', border: '1px solid var(--border)', fontFamily: 'inherit',
  fontSize: 13, color: 'var(--dark)', background: 'white', outline: 'none',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, letterSpacing: '1px',
  textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6,
};
const sectionStyle: React.CSSProperties = {
  background: 'white', border: '1px solid var(--border)', padding: '20px 24px', marginBottom: 16,
};
const sectionTitleStyle: React.CSSProperties = {
  fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--muted)',
  marginBottom: 16, display: 'block',
};
const pillStyle: Record<string, React.CSSProperties> = {
  active:  { background: '#e8f5e9', color: '#2d7d47' },
  paused:  { background: '#fff8e1', color: '#b07d00' },
  expired: { background: '#f3f3f3', color: '#666' },
  draft:   { background: '#ede7f6', color: '#5c35a8' },
};

export default function PromoCodeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [promo, setPromo] = useState<PromoCode | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [editForm, setEditForm] = useState<Partial<PromoCode & { validFromStr: string; validUntilStr: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/promo-codes/${id}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      setPromo(data);
      setEditForm({
        description: data.description,
        status: data.status || (data.active ? 'active' : 'paused'),
        type: data.type,
        value: data.value,
        minOrderValue: data.minOrderValue,
        redemptionType: data.redemptionType || (data.maxUsesPerCustomer === 1 ? 'single_use_per_customer' : 'unlimited'),
        maxUses: data.maxUses,
        source: data.source || '',
        validFromStr: data.validFrom ? new Date(data.validFrom).toISOString().slice(0, 16) : '',
        validUntilStr: data.validUntil ? new Date(data.validUntil).toISOString().slice(0, 16) : '',
      });
    } catch { /* ignore */ }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function setEF(key: string, value: unknown) {
    setEditForm(f => ({ ...f, [key]: value }));
  }

  async function saveEdit() {
    setSaving(true); setError('');
    try {
      const res = await fetch(`${API}/api/promo-codes/${id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description:    editForm.description,
          status:         editForm.status,
          active:         editForm.status === 'active',
          type:           editForm.type,
          value:          Number(editForm.value),
          minOrderValue:  Number(editForm.minOrderValue) || 0,
          redemptionType: editForm.redemptionType,
          maxUses:        editForm.redemptionType === 'capped_total' ? Number(editForm.maxUses) || null : null,
          maxUsesPerCustomer: editForm.redemptionType === 'single_use_per_customer' ? 1 : 999,
          source:         editForm.source,
          validFrom:      editForm.validFromStr || undefined,
          validUntil:     editForm.validUntilStr || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed');
      setEditing(false);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setSaving(false);
  }

  async function toggleStatus() {
    if (!promo) return;
    const next = resolveStatus(promo) === 'active' ? 'paused' : 'active';
    await fetch(`${API}/api/promo-codes/${id}`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next, active: next === 'active' }),
    });
    load();
  }

  async function deleteCode() {
    if (!promo || !confirm(`Deactivate ${promo.code}? This will also archive it in Stripe.`)) return;
    await fetch(`${API}/api/promo-codes/${id}`, { method: 'DELETE', credentials: 'include' });
    router.push('/admin/promo-codes');
  }

  if (loading) return <AdminLayout><div style={{ padding: 32, fontSize: 13, color: 'var(--muted)' }}>Loading…</div></AdminLayout>;
  if (!promo)  return <AdminLayout><div style={{ padding: 32, fontSize: 13, color: '#c0392b' }}>Promo code not found.</div></AdminLayout>;

  const st = resolveStatus(promo);
  const pill = pillStyle[st] || pillStyle.draft;

  return (
    <AdminLayout>
      <div style={{ padding: 32, maxWidth: 900 }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <Link href="/admin/promo-codes" style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none' }}>← Promo codes</Link>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 12, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 32, fontWeight: 400, color: 'var(--dark)', margin: 0, letterSpacing: '2px' }}>
                {promo.code}
              </h1>
              <span style={{ display: 'inline-block', padding: '3px 10px', fontSize: 10, letterSpacing: '0.8px', textTransform: 'uppercase', borderRadius: 2, ...pill }}>
                {st}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={() => setEditing(e => !e)} style={{ ...inputStyle, cursor: 'pointer', background: editing ? 'var(--dark)' : 'white', color: editing ? 'white' : 'var(--dark)' }}>
                {editing ? 'Cancel edit' : 'Edit'}
              </button>
              <button onClick={toggleStatus} style={{ ...inputStyle, cursor: 'pointer' }}>
                {st === 'active' ? 'Pause' : 'Resume'}
              </button>
              <button onClick={deleteCode} style={{ ...inputStyle, cursor: 'pointer', color: '#c0392b', borderColor: '#c0392b' }}>
                Delete
              </button>
            </div>
          </div>
          {promo.description && <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>{promo.description}</p>}
        </div>

        {/* Performance band */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', marginBottom: 24 }}>
          {[
            ['Redemptions', promo.maxUses ? `${promo.performance.totalRedemptions} / ${promo.maxUses}` : `${promo.performance.totalRedemptions} / ∞`],
            ['Discount given', `€${promo.performance.totalDiscountGiven.toFixed(2)}`],
            ['Revenue', `€${promo.performance.totalRevenue.toFixed(2)}`],
            ['Avg order', promo.performance.avgOrderValue !== null ? `€${promo.performance.avgOrderValue.toFixed(2)}` : '—'],
          ].map(([label, val]) => (
            <div key={label} style={{ background: 'white', padding: '16px 18px' }}>
              <div style={{ fontSize: 10, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 20, fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 400 }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Edit form (inline) */}
        {editing && (
          <div style={sectionStyle}>
            <span style={sectionTitleStyle}>Edit code</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Status</label>
                <select style={{ ...inputStyle, width: '100%' }} value={editForm.status} onChange={e => setEF('status', e.target.value)}>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="draft">Draft</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <input style={{ ...inputStyle, width: '100%' }} value={editForm.description} onChange={e => setEF('description', e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Type</label>
                <select style={{ ...inputStyle, width: '100%' }} value={editForm.type} onChange={e => setEF('type', e.target.value)}>
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed (€)</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Value</label>
                <input style={{ ...inputStyle, width: '100%' }} type="number" value={editForm.value} onChange={e => setEF('value', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Min order (€)</label>
                <input style={{ ...inputStyle, width: '100%' }} type="number" value={editForm.minOrderValue} onChange={e => setEF('minOrderValue', e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Redemption type</label>
                <select style={{ ...inputStyle, width: '100%' }} value={editForm.redemptionType || ''} onChange={e => setEF('redemptionType', e.target.value)}>
                  <option value="single_use_per_customer">Single use per customer</option>
                  <option value="unlimited">Unlimited</option>
                  <option value="capped_total">Capped total</option>
                </select>
              </div>
              {editForm.redemptionType === 'capped_total' && (
                <div>
                  <label style={labelStyle}>Max uses</label>
                  <input style={{ ...inputStyle, width: '100%' }} type="number" value={editForm.maxUses ?? ''} onChange={e => setEF('maxUses', e.target.value)} />
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Starts at</label>
                <input style={{ ...inputStyle, width: '100%' }} type="datetime-local" value={editForm.validFromStr} onChange={e => setEF('validFromStr', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Expires at</label>
                <input style={{ ...inputStyle, width: '100%' }} type="datetime-local" value={editForm.validUntilStr} onChange={e => setEF('validUntilStr', e.target.value)} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Source</label>
              <input style={{ ...inputStyle, width: '100%' }} value={editForm.source} onChange={e => setEF('source', e.target.value)} placeholder="newsletter_welcome, instagram_ad…" />
            </div>
            {error && <p style={{ color: '#c0392b', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <button onClick={saveEdit} disabled={saving} style={{
              padding: '10px 24px', fontSize: 13, fontFamily: 'inherit',
              cursor: saving ? 'default' : 'pointer',
              border: '1px solid var(--dark)', background: 'var(--dark)',
              color: 'white', letterSpacing: '0.04em', opacity: saving ? 0.6 : 1,
            }}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        )}

        {/* Summary */}
        <div style={sectionStyle}>
          <span style={sectionTitleStyle}>Summary</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {[
              ['Discount', promo.type === 'percentage' ? `${promo.value}% off` : `€${promo.value.toFixed(2)} off`],
              ['Applies to', promo.appliesTo || 'all'],
              ['Redemption', promo.redemptionType || (promo.maxUsesPerCustomer === 1 ? 'single per customer' : 'unlimited')],
              ['Min order', promo.minOrderValue > 0 ? `€${promo.minOrderValue}` : 'None'],
              ['Starts', promo.validFrom ? new Date(promo.validFrom).toLocaleDateString('en-IE') : '—'],
              ['Expires', promo.validUntil ? new Date(promo.validUntil).toLocaleDateString('en-IE') : 'No expiry'],
              ['Source', promo.source || '—'],
              ['Stripe', promo.stripeCouponId ? '✓ synced' : 'not synced'],
            ].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 13, color: 'var(--dark)' }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Redemptions table */}
        <div style={sectionStyle}>
          <span style={sectionTitleStyle}>Recent redemptions</span>
          {promo.redemptions.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>No redemptions yet.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Order', 'Date', 'Email', 'Discount', 'Status'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 400, borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {promo.redemptions.map(r => (
                  <tr key={r._id}>
                    <td style={{ padding: '10px 10px', borderBottom: '1px solid var(--border)' }}>
                      {r.orderId
                        ? <Link href={`/admin/orders/${r.orderId}`} style={{ color: 'var(--dark)', textDecoration: 'none' }}>{r.orderNumber}</Link>
                        : r.orderNumber || '—'
                      }
                    </td>
                    <td style={{ padding: '10px 10px', borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontSize: 12 }}>
                      {new Date(r.redeemedAt).toLocaleDateString('en-IE')}
                    </td>
                    <td style={{ padding: '10px 10px', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                      {r.customerEmail ? r.customerEmail.replace(/(.{3}).*@/, '$1***@') : '—'}
                    </td>
                    <td style={{ padding: '10px 10px', borderBottom: '1px solid var(--border)' }}>
                      €{(r.discountAmount || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '10px 10px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--muted)' }}>
                      {r.orderStatus || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
