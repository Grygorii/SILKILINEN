'use client';

import { useState } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';

const CHANNELS = ['meta', 'pinterest', 'google', 'tiktok', 'email', 'influencer', 'organic', 'other'];

function slugify(str: string) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

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

export default function UtmBuilderPage() {
  const [form, setForm] = useState({
    base: 'https://silkilinen.com',
    source: 'meta',
    medium: 'paid',
    campaign: '',
    content: '',
    term: '',
  });
  const [copied, setCopied] = useState(false);

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function buildUrl() {
    const params = new URLSearchParams();
    if (form.source)   params.set('utm_source', form.source);
    if (form.medium)   params.set('utm_medium', form.medium);
    if (form.campaign) params.set('utm_campaign', slugify(form.campaign) || form.campaign);
    if (form.content)  params.set('utm_content', form.content);
    if (form.term)     params.set('utm_term', form.term);
    const base = form.base.replace(/\/$/, '');
    return `${base}?${params.toString()}`;
  }

  async function copy() {
    await navigator.clipboard.writeText(buildUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const url = buildUrl();

  return (
    <AdminLayout>
      <div style={{ padding: 32, maxWidth: 640 }}>
        <div style={{ marginBottom: 28 }}>
          <Link href="/admin/marketing" style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none' }}>← Marketing</Link>
          <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 400, color: 'var(--dark)', marginTop: 10, marginBottom: 4 }}>
            UTM link builder
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Build tracked links for your ad campaigns.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label style={label}>Destination URL</label>
            <input style={field} value={form.base} onChange={e => set('base', e.target.value)} placeholder="https://silkilinen.com/shop" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={label}>Source (utm_source)</label>
              <select style={field} value={form.source} onChange={e => set('source', e.target.value)}>
                {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={label}>Medium (utm_medium)</label>
              <input style={field} value={form.medium} onChange={e => set('medium', e.target.value)} placeholder="paid / email / organic" />
            </div>
          </div>

          <div>
            <label style={label}>Campaign (utm_campaign)</label>
            <input style={field} value={form.campaign} onChange={e => set('campaign', e.target.value)} placeholder="Must match your campaign slug exactly" />
            {form.campaign && (
              <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                Slug preview: <code>{slugify(form.campaign) || form.campaign}</code>
              </p>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={label}>Creative (utm_content)</label>
              <input style={field} value={form.content} onChange={e => set('content', e.target.value)} placeholder="video-a / carousel-1" />
            </div>
            <div>
              <label style={label}>Keyword (utm_term)</label>
              <input style={field} value={form.term} onChange={e => set('term', e.target.value)} placeholder="Optional" />
            </div>
          </div>
        </div>

        {/* Output */}
        <div style={{ marginTop: 28, background: '#f5f2ec', border: '1px solid var(--border)', padding: '16px 18px' }}>
          <div style={{ fontSize: 10, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>Your link</div>
          <p style={{ fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all', color: 'var(--dark)', margin: '0 0 16px' }}>{url}</p>
          <button onClick={copy} style={{
            padding: '9px 22px', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
            border: '1px solid var(--dark)', background: copied ? 'var(--dark)' : 'white',
            color: copied ? 'white' : 'var(--dark)', letterSpacing: '0.04em', transition: 'all 0.15s',
          }}>
            {copied ? 'Copied!' : 'Copy link'}
          </button>
        </div>

        <div style={{ marginTop: 24, background: 'white', border: '1px solid var(--border)', padding: '14px 18px', fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--dark)', fontSize: 11, letterSpacing: '0.8px', textTransform: 'uppercase' }}>Tips</strong><br />
          The <strong>campaign slug</strong> must exactly match the slug in your campaign record for attribution to work.<br />
          Use <strong>utm_content</strong> to track which creative drove each order.<br />
          Paste UTM links directly into Meta Ads Manager, Pinterest Ads, or anywhere as the destination URL.
        </div>
      </div>
    </AdminLayout>
  );
}
