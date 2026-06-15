'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import Link from 'next/link';
import { toast } from '@/lib/adminToast';

const API = process.env.NEXT_PUBLIC_API_URL;

type Settings = {
  welcomeOfferPercent: number;
  welcomeOfferCode: string;
  supportEmail: string;
  brandTagline: string;
  brandLocation: string;
  freeShippingThreshold: number;
};

const EMPTY: Settings = {
  welcomeOfferPercent: 10, welcomeOfferCode: 'SILK10',
  supportEmail: '', brandTagline: '', brandLocation: '', freeShippingThreshold: 150,
};

const label: React.CSSProperties = { display: 'block', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', margin: '16px 0 6px' };
const input: React.CSSProperties = { width: '100%', maxWidth: 420, padding: '9px 12px', border: '1px solid var(--border, #d9d2c6)', fontSize: 14, background: '#fff' };
const hint: React.CSSProperties = { fontSize: 12, color: 'var(--muted)', marginTop: 4 };

export default function BusinessSettingsPage() {
  const [s, setS] = useState<Settings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/settings`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setS({ ...EMPTY, ...d }); })
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof Settings>(k: K, v: Settings[K]) {
    setS(prev => ({ ...prev, [k]: v }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/settings`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Save failed');
      setS({ ...EMPTY, ...(await res.json()) });
      toast('Settings saved — live across the site.', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout>
      <div style={{ maxWidth: 640 }}>
        <Link href="/admin/settings" style={{ fontSize: 13, color: 'var(--muted)', textDecoration: 'none' }}>← Settings</Link>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, margin: '8px 0 4px' }}>Business &amp; offers</h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0 }}>
          Edit these once and they update everywhere — the welcome offer across the banner, newsletter and pop-up
          (and the discount actually issued), plus your business details across the site and emails.
        </p>

        {loading ? (
          <p style={{ marginTop: 24, color: 'var(--muted)' }}>Loading…</p>
        ) : (
          <div style={{ marginTop: 20 }}>
            <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 17, marginBottom: 0 }}>Welcome offer</h3>
            <label style={label}>Discount %</label>
            <input style={{ ...input, maxWidth: 140 }} type="number" min={0} max={90} value={s.welcomeOfferPercent}
              onChange={e => set('welcomeOfferPercent', Number(e.target.value))} />
            <p style={hint}>Changes both the advertised copy and the actual code customers are issued on signup.</p>

            <label style={label}>Advertised code</label>
            <input style={{ ...input, maxWidth: 200 }} value={s.welcomeOfferCode}
              onChange={e => set('welcomeOfferCode', e.target.value)} />
            <p style={hint}>The code shown in marketing (real per-signup codes are unique).</p>

            <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 17, margin: '28px 0 0' }}>Business details</h3>
            <label style={label}>Support email</label>
            <input style={input} type="email" value={s.supportEmail} onChange={e => set('supportEmail', e.target.value)} />

            <label style={label}>Brand tagline</label>
            <input style={input} value={s.brandTagline} onChange={e => set('brandTagline', e.target.value)} />

            <label style={label}>Location</label>
            <input style={input} value={s.brandLocation} onChange={e => set('brandLocation', e.target.value)} />

            <label style={label}>Free shipping threshold (€)</label>
            <input style={{ ...input, maxWidth: 140 }} type="number" min={0} value={s.freeShippingThreshold}
              onChange={e => set('freeShippingThreshold', Number(e.target.value))} />
            <p style={hint}>Display only — the actual per-region free thresholds live in Settings → Shipping.</p>

            <div style={{ marginTop: 24 }}>
              <button onClick={save} disabled={saving}
                style={{ background: 'var(--dark, #1a1916)', color: '#fff', border: 'none', padding: '10px 22px', fontSize: 14, cursor: saving ? 'default' : 'pointer' }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
