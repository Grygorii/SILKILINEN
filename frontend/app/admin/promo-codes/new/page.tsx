'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';

const API = process.env.NEXT_PUBLIC_API_URL;

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1px solid var(--border)',
  fontFamily: 'inherit', fontSize: 13, color: 'var(--dark)',
  background: 'white', boxSizing: 'border-box', outline: 'none',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, letterSpacing: '1px',
  textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6,
};
const hintStyle: React.CSSProperties = { fontSize: 11, color: 'var(--muted)', marginTop: 4 };
const radioGroupStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8 };
const radioLabelStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' };
const sectionStyle: React.CSSProperties = {
  background: 'white', border: '1px solid var(--border)', padding: '22px 24px', marginBottom: 16,
};
const sectionTitleStyle: React.CSSProperties = {
  fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--muted)',
  marginBottom: 18, display: 'block',
};

type Form = {
  code: string; description: string; status: string;
  type: string; value: string; minOrderValue: string;
  appliesTo: string;
  redemptionType: string; maxUses: string;
  validFrom: string; validUntil: string;
  source: string;
};

export default function NewPromoCodePage() {
  const router = useRouter();
  const [form, setForm] = useState<Form>({
    code: '', description: '', status: 'draft',
    type: 'percentage', value: '10', minOrderValue: '',
    appliesTo: 'all',
    redemptionType: 'single_use_per_customer', maxUses: '',
    validFrom: '', validUntil: '',
    source: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(key: keyof Form, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code.trim()) { setError('Code is required'); return; }
    if (!form.value || isNaN(Number(form.value))) { setError('Discount value is required'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch(`${API}/api/promo-codes`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code:           form.code.trim().toUpperCase(),
          description:    form.description.trim(),
          status:         form.status,
          active:         form.status === 'active',
          type:           form.type,
          value:          Number(form.value),
          minOrderValue:  form.minOrderValue ? Number(form.minOrderValue) : 0,
          appliesTo:      form.appliesTo,
          redemptionType: form.redemptionType,
          maxUses:        form.redemptionType === 'capped_total' && form.maxUses ? Number(form.maxUses) : null,
          maxUsesPerCustomer: form.redemptionType === 'single_use_per_customer' ? 1 : 999,
          validFrom:      form.validFrom || undefined,
          validUntil:     form.validUntil || null,
          source:         form.source.trim(),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || await res.text());
      const created = await res.json();
      router.push(`/admin/promo-codes/${created._id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <AdminLayout>
      <div style={{ padding: 32, maxWidth: 620 }}>
        <div style={{ marginBottom: 28 }}>
          <Link href="/admin/promo-codes" style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none' }}>
            ← Promo codes
          </Link>
          <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 400, color: 'var(--dark)', marginTop: 10, marginBottom: 4 }}>
            New promo code
          </h1>
        </div>

        <form onSubmit={submit}>
          {/* Section 1 — Basics */}
          <div style={sectionStyle}>
            <span style={sectionTitleStyle}>Code basics</span>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Code *</label>
              <input style={inputStyle} value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="SILK10" />
              <p style={hintStyle}>Auto-uppercased. Must be unique.</p>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Description <span style={{ textTransform: 'none', fontSize: 10 }}>(admin only, optional)</span></label>
              <input style={inputStyle} value={form.description} onChange={e => set('description', e.target.value)} placeholder="e.g. Newsletter welcome — 10% off first order" />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select style={inputStyle} value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="draft">Draft (not live yet)</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </select>
            </div>
          </div>

          {/* Section 2 — Discount */}
          <div style={sectionStyle}>
            <span style={sectionTitleStyle}>Discount</span>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Discount type</label>
              <div style={radioGroupStyle}>
                <label style={radioLabelStyle}>
                  <input type="radio" name="type" value="percentage" checked={form.type === 'percentage'} onChange={() => set('type', 'percentage')} />
                  Percentage off (%)
                </label>
                <label style={radioLabelStyle}>
                  <input type="radio" name="type" value="fixed" checked={form.type === 'fixed'} onChange={() => set('type', 'fixed')} />
                  Fixed amount off (€)
                </label>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 0 }}>
              <div>
                <label style={labelStyle}>Value {form.type === 'percentage' ? '(%)' : '(€)'} *</label>
                <input style={inputStyle} type="number" min="0.01" step="0.01" value={form.value} onChange={e => set('value', e.target.value)} placeholder={form.type === 'percentage' ? '10' : '5.00'} />
              </div>
              <div>
                <label style={labelStyle}>Minimum order (€)</label>
                <input style={inputStyle} type="number" min="0" step="0.01" value={form.minOrderValue} onChange={e => set('minOrderValue', e.target.value)} placeholder="Leave empty for none" />
              </div>
            </div>
          </div>

          {/* Section 3 — Applies to */}
          <div style={sectionStyle}>
            <span style={sectionTitleStyle}>What it applies to</span>
            <div style={radioGroupStyle}>
              <label style={radioLabelStyle}>
                <input type="radio" name="appliesTo" value="all" checked={form.appliesTo === 'all'} onChange={() => set('appliesTo', 'all')} />
                Whole cart
              </label>
              <label style={{ ...radioLabelStyle, color: 'var(--muted)' }}>
                <input type="radio" name="appliesTo" value="specific_products" disabled />
                Specific products <span style={{ fontSize: 11 }}>(coming soon)</span>
              </label>
              <label style={{ ...radioLabelStyle, color: 'var(--muted)' }}>
                <input type="radio" name="appliesTo" value="specific_collections" disabled />
                Specific collections <span style={{ fontSize: 11 }}>(coming soon)</span>
              </label>
            </div>
          </div>

          {/* Section 4 — Redemption rules */}
          <div style={sectionStyle}>
            <span style={sectionTitleStyle}>Redemption rules</span>
            <div style={{ ...radioGroupStyle, marginBottom: form.redemptionType === 'capped_total' ? 14 : 0 }}>
              <label style={radioLabelStyle}>
                <input type="radio" name="redemptionType" value="single_use_per_customer" checked={form.redemptionType === 'single_use_per_customer'} onChange={() => set('redemptionType', 'single_use_per_customer')} />
                Single use per customer
              </label>
              <label style={radioLabelStyle}>
                <input type="radio" name="redemptionType" value="unlimited" checked={form.redemptionType === 'unlimited'} onChange={() => set('redemptionType', 'unlimited')} />
                Unlimited
              </label>
              <label style={radioLabelStyle}>
                <input type="radio" name="redemptionType" value="capped_total" checked={form.redemptionType === 'capped_total'} onChange={() => set('redemptionType', 'capped_total')} />
                Capped total uses
              </label>
            </div>
            {form.redemptionType === 'capped_total' && (
              <div style={{ marginTop: 14 }}>
                <label style={labelStyle}>Max total uses *</label>
                <input style={{ ...inputStyle, maxWidth: 160 }} type="number" min="1" value={form.maxUses} onChange={e => set('maxUses', e.target.value)} placeholder="e.g. 100" />
              </div>
            )}
          </div>

          {/* Section 5 — Validity */}
          <div style={sectionStyle}>
            <span style={sectionTitleStyle}>Validity</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={labelStyle}>Starts at</label>
                <input style={inputStyle} type="datetime-local" value={form.validFrom} onChange={e => set('validFrom', e.target.value)} />
                <p style={hintStyle}>Leave empty to activate immediately</p>
              </div>
              <div>
                <label style={labelStyle}>Expires at</label>
                <input style={inputStyle} type="datetime-local" value={form.validUntil} onChange={e => set('validUntil', e.target.value)} />
                <p style={hintStyle}>Leave empty for no expiry</p>
              </div>
            </div>
          </div>

          {/* Section 6 — Attribution */}
          <div style={sectionStyle}>
            <span style={sectionTitleStyle}>Attribution (optional)</span>
            <div>
              <label style={labelStyle}>Source</label>
              <input style={inputStyle} value={form.source} onChange={e => set('source', e.target.value)} placeholder="e.g. newsletter_welcome, instagram_ad, manual" />
            </div>
          </div>

          {error && <p style={{ color: '#c0392b', fontSize: 13, marginBottom: 16 }}>{error}</p>}

          <button type="submit" disabled={saving} style={{
            padding: '11px 28px', fontSize: 13, fontFamily: 'inherit',
            cursor: saving ? 'default' : 'pointer',
            border: '1px solid var(--dark)', background: 'var(--dark)',
            color: 'white', letterSpacing: '0.04em', opacity: saving ? 0.6 : 1,
          }}>
            {saving ? 'Creating…' : 'Create promo code'}
          </button>
        </form>
      </div>
    </AdminLayout>
  );
}
