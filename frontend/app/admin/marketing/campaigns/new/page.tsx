'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';

const API = process.env.NEXT_PUBLIC_API_URL;

const CHANNELS = ['meta', 'pinterest', 'google', 'tiktok', 'email', 'influencer', 'organic', 'other'];

const field: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--border)',
  fontFamily: 'inherit',
  fontSize: 13,
  color: 'var(--dark)',
  background: 'white',
  boxSizing: 'border-box',
  outline: 'none',
};

const label: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  letterSpacing: '1px',
  textTransform: 'uppercase',
  color: 'var(--muted)',
  marginBottom: 6,
};

export default function NewCampaignPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    channel: 'meta',
    startDate: '',
    endDate: '',
    budget: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Campaign name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/admin/campaigns`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:      form.name.trim(),
          channel:   form.channel,
          startDate: form.startDate || undefined,
          endDate:   form.endDate   || undefined,
          budget:    form.budget ? parseFloat(form.budget) : 0,
          notes:     form.notes.trim(),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const camp = await res.json();
      router.push(`/admin/marketing/campaigns/${camp._id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <AdminLayout>
      <div style={{ padding: 32, maxWidth: 560 }}>
        <div style={{ marginBottom: 28 }}>
          <Link href="/admin/marketing" style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none' }}>
            ← Marketing
          </Link>
          <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 400, color: 'var(--dark)', marginTop: 10, marginBottom: 4 }}>
            New campaign
          </h1>
        </div>

        <form onSubmit={submit}>
          <div style={{ marginBottom: 20 }}>
            <label style={label}>Campaign name *</label>
            <input style={field} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Summer Silk Launch" />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={label}>Channel</label>
            <select style={field} value={form.channel} onChange={e => set('channel', e.target.value)}>
              {CHANNELS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={label}>Start date</label>
              <input style={field} type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
            </div>
            <div>
              <label style={label}>End date</label>
              <input style={field} type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={label}>Budget (€)</label>
            <input style={field} type="number" step="0.01" min="0" value={form.budget} onChange={e => set('budget', e.target.value)} placeholder="0.00" />
          </div>

          <div style={{ marginBottom: 28 }}>
            <label style={label}>Notes</label>
            <textarea style={{ ...field, minHeight: 80, resize: 'vertical' }} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Target audience, creative brief, links…" />
          </div>

          {error && <p style={{ color: '#c0392b', fontSize: 13, marginBottom: 16 }}>{error}</p>}

          <button type="submit" disabled={saving} style={{
            padding: '11px 28px', fontSize: 13, fontFamily: 'inherit', cursor: saving ? 'default' : 'pointer',
            border: '1px solid var(--dark)', background: 'var(--dark)', color: 'white', letterSpacing: '0.04em',
            opacity: saving ? 0.6 : 1,
          }}>
            {saving ? 'Creating…' : 'Create campaign'}
          </button>
        </form>
      </div>
    </AdminLayout>
  );
}
