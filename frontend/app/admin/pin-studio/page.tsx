'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';

const API = process.env.NEXT_PUBLIC_API_URL;
const dark = 'var(--dark, #2a2218)';
const muted = 'var(--muted, #8a8680)';
const border = '1px solid var(--border, #e8e2d6)';
const serif = "'Cormorant Garamond', Georgia, serif";

type Article = { _id: string; title: string; slug: string; status: string };
type Pin = {
  angle: string; imagePrompt: string; overlayHook: string; pinTitle: string;
  pinDescription: string; keywords: string[]; board: string; link: string;
};

function Field({ label, value, big }: { label: string; value: string; big?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* noop */ }
  }
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: muted }}>{label}</span>
        <button onClick={copy} style={{ fontSize: 11, color: copied ? '#5a8f3d' : dark, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          {copied ? '✓ copied' : 'copy'}
        </button>
      </div>
      <div style={{ fontSize: big ? 12 : 13, color: dark, lineHeight: 1.5, background: 'var(--warm-white,#faf8f4)', border, padding: '8px 10px', whiteSpace: 'pre-wrap' }}>{value}</div>
    </div>
  );
}

export default function PinStudioPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [selected, setSelected] = useState('');
  const [pins, setPins] = useState<Pin[]>([]);
  const [articleTitle, setArticleTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadArticles = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/admin/pin-studio/articles`, { credentials: 'include' });
      const d = await res.json();
      if (d?.articles) { setArticles(d.articles); if (d.articles[0]) setSelected(d.articles[0]._id); }
    } catch { /* noop */ }
  }, []);
  useEffect(() => { loadArticles(); }, [loadArticles]);

  async function generate() {
    if (!selected) return;
    setLoading(true); setError(''); setPins([]);
    try {
      const res = await fetch(`${API}/api/admin/pin-studio/generate`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: selected }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d?.error || 'Generation failed.'); return; }
      setPins(d.pins || []); setArticleTitle(d.article?.title || '');
    } catch { setError('Network error — try again.'); }
    finally { setLoading(false); }
  }

  return (
    <AdminLayout active="pin-studio">
      <div style={{ padding: '32px 40px', maxWidth: 1000 }}>
        <h1 style={{ fontFamily: serif, fontSize: 30, fontWeight: 300, color: dark, margin: 0, letterSpacing: '1px' }}>Pin Studio</h1>
        <p style={{ fontSize: 13, color: muted, marginTop: 6, fontStyle: 'italic', maxWidth: 680 }}>
          Turn a journal article into 3 ready-to-post Pinterest pins. Each gives you an AI image prompt, the overlay hook to add by hand, a keyword-rich title &amp; description, and a tracked link — so durable Pinterest search traffic flows to your articles and into leads.
        </p>

        <div style={{ display: 'flex', gap: 10, margin: '20px 0', flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={selected} onChange={e => setSelected(e.target.value)} style={{ flex: 1, minWidth: 280, padding: '10px 12px', border, background: 'white', fontFamily: 'inherit', fontSize: 14, color: dark }}>
            {articles.length === 0 && <option value="">No articles yet</option>}
            {articles.map(a => (
              <option key={a._id} value={a._id}>{a.title}{a.status !== 'published' ? ` (${a.status})` : ''}</option>
            ))}
          </select>
          <button onClick={generate} disabled={loading || !selected} style={{ padding: '10px 20px', background: dark, color: '#faf8f4', border: 'none', cursor: loading || !selected ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', opacity: loading || !selected ? 0.6 : 1 }}>
            {loading ? 'Composing…' : '✦ Generate 3 pins'}
          </button>
        </div>

        {error && <p style={{ fontSize: 13, color: '#c0392b' }}>{error}</p>}
        {loading && <p style={{ fontSize: 13, color: muted }}>Composing pins for this article…</p>}

        {pins.length > 0 && (
          <>
            <p style={{ fontSize: 12.5, color: muted, margin: '4px 0 16px' }}>3 pins for <strong style={{ color: dark }}>{articleTitle}</strong>. Feed each image prompt to your image tool, drop the hook on, then paste the rest into Pinterest.</p>
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
