'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';

const API = process.env.NEXT_PUBLIC_API_URL;

export default function NewCustomerPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: '', firstName: '', lastName: '', phone: '',
    marketingConsent: false, customerType: 'retail', tags: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function set(k: string, v: string | boolean) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.email) { setError('Email is required.'); return; }
    setSaving(true);
    const res = await fetch(`${API}/api/admin/customers`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        marketingConsent: form.marketingConsent,
        customerType: form.customerType,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      if (res.status === 409 && data.customerId) {
        router.push(`/admin/customers/${data.customerId}`);
        return;
      }
      setError(data.error || 'Something went wrong.');
      return;
    }
    router.push(`/admin/customers/${data._id}`);
  }

  const label: React.CSSProperties = { fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4, display: 'block' };
  const input: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 13, boxSizing: 'border-box' };

  return (
    <AdminLayout>
      <div style={{ padding: '24px 28px', maxWidth: 600 }}>
        <Link href="/admin/customers" style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none' }}>← Customers</Link>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--dark)', margin: '12px 0 24px' }}>New customer</h1>

        <form onSubmit={submit} style={{ background: 'white', border: '1px solid var(--border)', padding: '24px 28px' }}>
          {error && <p style={{ color: '#c0392b', fontSize: 13, marginBottom: 16 }}>{error}</p>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={label}>Email *</label>
              <input value={form.email} onChange={e => set('email', e.target.value)} type="email" required style={input} />
            </div>
            <div>
              <label style={label}>Phone</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} type="tel" style={input} />
            </div>
            <div>
              <label style={label}>First name</label>
              <input value={form.firstName} onChange={e => set('firstName', e.target.value)} style={input} />
            </div>
            <div>
              <label style={label}>Last name</label>
              <input value={form.lastName} onChange={e => set('lastName', e.target.value)} style={input} />
            </div>
            <div>
              <label style={label}>Customer type</label>
              <select value={form.customerType} onChange={e => set('customerType', e.target.value)} style={{ ...input, padding: '7px 10px' }}>
                {['retail', 'wholesale', 'vip', 'internal'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={label}>Tags (comma-separated)</label>
              <input value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="e.g. stylist, press, influencer" style={input} />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--dark)', cursor: 'pointer', marginBottom: 24 }}>
            <input type="checkbox" checked={form.marketingConsent} onChange={e => set('marketingConsent', e.target.checked)} />
            Marketing consent (email opt-in)
          </label>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" disabled={saving} style={{ padding: '10px 22px', background: 'var(--dark)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
              {saving ? 'Saving…' : 'Create customer'}
            </button>
            <Link href="/admin/customers" style={{ padding: '10px 18px', border: '1px solid var(--border)', color: 'var(--dark)', textDecoration: 'none', fontSize: 13 }}>
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
