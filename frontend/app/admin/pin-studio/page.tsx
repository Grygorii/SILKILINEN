'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';

const API = process.env.NEXT_PUBLIC_API_URL;
const dark = 'var(--dark, #2a2218)';
const muted = 'var(--muted, #8a8680)';
const border = '1px solid var(--border, #e8e2d6)';
const serif = "'Cormorant Garamond', Georgia, serif";

type SourceType = 'article' | 'product' | 'review';
type Item = { id: string; label: string; note?: string };
type Sources = Record<SourceType, Item[]>;
type Pin = {
  angle: string; imagePrompt: string; overlayHook: string; pinTitle: string;
  pinDescription: string; keywords: string[]; board: string; link: string;
};
type Traffic = { total: number; bySource: { source: string; visits: number }[]; topCampaigns: { campaign: string; visits: number }[] };

const TABS: { key: SourceType; label: string; hint: string }[] = [
  { key: 'article', label: 'Articles', hint: 'Drive durable search traffic to your guides — best for evergreen how-tos.' },
  { key: 'product', label: 'Products', hint: 'Shoppable pins straight to the product page.' },
  { key: 'review', label: 'Reviews', hint: 'Turn real customer words into social-proof testimonial pins.' },
];

function Field({ label, value, big }: { label: string; value: string; big?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* noop */ }
  }
  if (!value) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: muted }}>{label}</span>
        <button onClick={copy} style={{ fontSize: 11, color: copied ? '#5a8f3d' : dark, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>{copied ? '✓ copied' : 'copy'}</button>
      </div>
      <div style={{ fontSize: big ? 12 : 13, color: dark, lineHeight: 1.5, background: 'var(--warm-white,#faf8f4)', border, padding: '8px 10px', whiteSpace: 'pre-wrap' }}>{value}</div>
    </div>
  );
}

export default function PinStudioPage() {
  const [sources, setSources] = useState<Sources | null>(null);
  const [tab, setTab] = useState<SourceType>('article');
  const [selected, setSelected] = useState('');
  const [pins, setPins] = useState<Pin[]>([]);
  const [sourceTitle, setSourceTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [traffic, setTraffic] = useState<Traffic | null>(null);

  const load = useCallback(async () => {
    try {
      const [sRes, tRes] = await Promise.all([
        fetch(`${API}/api/admin/pin-studio/sources`, { credentials: 'include' }),
        fetch(`${API}/api/admin/pin-studio/traffic`, { credentials: 'include' }),
      ]);
      if (sRes.ok) setSources(await sRes.json());
      if (tRes.ok) setTraffic(await tRes.json());
    } catch { /* noop */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const items = sources?.[tab] || [];
  useEffect(() => { setSelected(items[0]?.id || ''); }, [tab, sources]); // eslint-disable-line react-hooks/exhaustive-deps

  async function generate() {
    if (!selected) return;
    setLoading(true); setError(''); setPins([]);
    try {
      const res = await fetch(`${API}/api/admin/pin-studio/generate`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: tab, id: selected }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d?.error || 'Generation failed.'); return; }
      setPins(d.pins || []); setSourceTitle(d.source?.title || '');
    } catch { setError('Network error — try again.'); }
    finally { setLoading(false); }
  }

  return (
    <AdminLayout active="pin-studio">
      <div style={{ padding: '32px 40px', maxWidth: 1000 }}>
        <h1 style={{ fontFamily: serif, fontSize: 30, fontWeight: 300, color: dark, margin: 0, letterSpacing: '1px' }}>Pin Studio</h1>
        <p style={{ fontSize: 13, color: muted, marginTop: 6, fontStyle: 'italic', maxWidth: 700 }}>
          Turn any asset — an article, a product, or a customer review — into 3 ready-to-post Pinterest pins. Every link is tracked, so durable search traffic flows to pages that capture leads, and you can see what works.
        </p>

        {/* Performance loop */}
        {traffic && (
          <div style={{ border, background: 'var(--warm-white,#faf8f4)', padding: '12px 18px', margin: '18px 0', display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'baseline' }}>
            <span style={{ fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: muted }}>Social traffic · 30d</span>
            <span style={{ fontSize: 15, color: dark }}><strong>{traffic.total}</strong> visits</span>
            {traffic.bySource.map(s => <span key={s.source} style={{ fontSize: 12.5, color: muted }}>{s.source}: <strong style={{ color: dark }}>{s.visits}</strong></span>)}
            {traffic.topCampaigns.length > 0 && <span style={{ fontSize: 12, color: muted, marginLeft: 'auto' }}>top: {traffic.topCampaigns.slice(0, 3).map(c => c.campaign).join(' · ')}</span>}
            {traffic.total === 0 && <span style={{ fontSize: 12, color: muted, fontStyle: 'italic' }}>nothing yet — post a few pins and this fills in</span>}
          </div>
        )}

        {/* Source tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setPins([]); }} style={{ padding: '8px 16px', fontSize: 13, background: tab === t.key ? dark : 'white', color: tab === t.key ? '#faf8f4' : dark, border, cursor: 'pointer', fontFamily: 'inherit' }}>{t.label}</button>
          ))}
        </div>
        <p style={{ fontSize: 12, color: muted, margin: '0 0 14px' }}>{TABS.find(t => t.key === tab)?.hint}</p>

        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={selected} onChange={e => setSelected(e.target.value)} style={{ flex: 1, minWidth: 300, padding: '10px 12px', border, background: 'white', fontFamily: 'inherit', fontSize: 14, color: dark }}>
            {items.length === 0 && <option value="">Nothing here yet</option>}
            {items.map(i => <option key={i.id} value={i.id}>{i.label}{i.note ? ` · ${i.note}` : ''}</option>)}
          </select>
          <button onClick={generate} disabled={loading || !selected} style={{ padding: '10px 20px', background: dark, color: '#faf8f4', border: 'none', cursor: loading || !selected ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', opacity: loading || !selected ? 0.6 : 1 }}>{loading ? 'Composing…' : '✦ Generate 3 pins'}</button>
        </div>

        {error && <p style={{ fontSize: 13, color: '#c0392b' }}>{error}</p>}
        {loading && <p style={{ fontSize: 13, color: muted }}>Composing pins…</p>}

        {pins.length > 0 && (
          <>
            <p style={{ fontSize: 12.5, color: muted, margin: '4px 0 16px' }}>3 pins for <strong style={{ color: dark }}>{sourceTitle}</strong>. Feed each image prompt to your image tool, drop the hook on, then paste the rest into Pinterest.</p>
            <div style={{ display: 'grid', gap: 16 }}>
              {pins.map((p, i) => (
                <div key={i} style={{ border, background: 'white', padding: '18px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                    <span style={{ fontFamily: serif, fontSize: 18, color: dark }}>Pin {i + 1}</span>
                    {p.angle && <span style={{ fontSize: 11, letterSpacing: '0.5px', textTransform: 'uppercase', color: muted, border, padding: '2px 8px' }}>{p.angle}</span>}
                  </div>
                  <Field label="🖼 Image prompt (feed to your image model)" value={p.imagePrompt} big />
                  <Field label="✍ Overlay hook (add onto the image)" value={p.overlayHook} />
                  <Field label="📌 Pin title" value={p.pinTitle} />
                  <Field label="Pin description" value={p.pinDescription} />
                  <Field label="Keywords" value={p.keywords.join(', ')} />
                  <Field label="Tracked link (paste as the pin destination)" value={p.link} />
                  {p.board && <p style={{ fontSize: 12, color: muted, margin: '2px 0 0' }}>Suggested board: <strong style={{ color: dark }}>{p.board}</strong></p>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
