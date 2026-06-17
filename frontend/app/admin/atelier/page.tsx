'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { toast } from '@/lib/adminToast';

const API = process.env.NEXT_PUBLIC_API_URL;

type Dissonance = { what: string; why: string; fix: string; severity: 'high' | 'medium' | 'low' };
type Fix = { title: string; where: string; how: string; agent: string };
type Review = {
  _id: string; wowScore: number; verdict: string; firstImpression: string;
  strengths: string[]; dissonances: Dissonance[]; fixes: Fix[]; benchmark: string;
  imagesReviewed: string[]; usedVision: boolean; usedFallback: boolean; createdAt: string;
};

const dark = 'var(--dark, #2a2218)';
const muted = 'var(--muted, #8a8680)';
const border = '1px solid var(--border, #e8e2d6)';
const serif = "'Cormorant Garamond', Georgia, serif";
const sevColor = { high: '#b03a2e', medium: '#b8863b', low: muted } as const;

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

export default function AtelierPage() {
  const [busy, setBusy] = useState(false);
  const [visionReady, setVisionReady] = useState(true);
  const [review, setReview] = useState<Review | null>(null);
  const [history, setHistory] = useState<Review[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/admin/atelier`, { credentials: 'include' });
      const data = await res.json();
      setVisionReady(data.visionReady !== false);
      if (Array.isArray(data.reviews)) { setHistory(data.reviews); if (!review && data.reviews[0]) setReview(data.reviews[0]); }
    } catch { /* ignore */ }
  }, [review]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function runReview() {
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/admin/atelier/review`, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Review failed');
      setReview(data); load();
      toast('The creative director has reviewed your entrance.', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Review failed', 'error');
    } finally { setBusy(false); }
  }

  return (
    <AdminLayout>
      <div style={{ padding: '32px 40px', maxWidth: 960 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <h1 style={{ fontFamily: serif, fontSize: 28, fontWeight: 300, color: dark, margin: 0, letterSpacing: '1px' }}>The Atelier</h1>
            <p style={{ fontSize: 13, color: muted, marginTop: 6, fontStyle: 'italic' }}>
              A luxury creative director with real eyes — it looks at your entrance and judges the wow.
            </p>
          </div>
          <button onClick={runReview} disabled={busy} style={{
            padding: '11px 22px', background: dark, color: 'white', border: 'none',
            cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: 'inherit', fontSize: 13, letterSpacing: '0.5px', whiteSpace: 'nowrap',
          }}>{busy ? 'Looking… (~30s)' : '✦ Review the entrance'}</button>
        </div>

        {!visionReady && (
          <div style={{ marginTop: 20, padding: '14px 18px', background: '#fdf6e9', border: '1px solid #e6d9bf', fontSize: 13, color: '#8a6d2f' }}>
            The Atelier has no eyes yet — set <strong>GEMINI_API_KEY</strong> in Railway (the same key as Image Studio) to let it see the site.
          </div>
        )}

        {review && <ReviewView review={review} />}

        {history.length > 1 && (
          <div style={{ marginTop: 30 }}>
            <h2 style={{ fontFamily: serif, fontSize: 18, color: dark, marginBottom: 10 }}>Past reviews</h2>
            <div style={{ display: 'grid', gap: 8 }}>
              {history.map(h => (
                <button key={h._id} onClick={() => setReview(h)} style={{ textAlign: 'left', background: 'white', border, padding: '10px 14px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: 13, color: dark }}>{h.verdict || 'Entrance review'}</span>
                  <span style={{ fontSize: 12, color: muted, whiteSpace: 'nowrap' }}>{h.wowScore ? `${h.wowScore}/10 · ` : ''}{timeAgo(h.createdAt)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function ReviewView({ review }: { review: Review }) {
  const score = review.wowScore;
  const scoreColor = score >= 8 ? '#2d7d47' : score >= 6 ? '#b8863b' : '#b03a2e';
  return (
    <div style={{ background: 'white', border, padding: '24px 26px', marginTop: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        {score > 0 && (
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontFamily: serif, fontSize: 46, fontWeight: 400, color: scoreColor, lineHeight: 1 }}>{score}<span style={{ fontSize: 20, color: muted }}>/10</span></div>
            <div style={{ fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: muted, marginTop: 4 }}>Entrance wow</div>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 280 }}>
          <p style={{ fontFamily: serif, fontSize: 20, color: dark, margin: 0, lineHeight: 1.35 }}>{review.verdict}</p>
          {review.firstImpression && <p style={{ fontSize: 13.5, color: muted, marginTop: 8, lineHeight: 1.6 }}>{review.firstImpression}</p>}
        </div>
      </div>

      {review.imagesReviewed?.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
          {review.imagesReviewed.map((u, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={u} alt="" style={{ width: 84, height: 110, objectFit: 'cover', border }} />
          ))}
        </div>
      )}

      {review.strengths?.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#2d7d47', margin: '0 0 8px' }}>What already reads as luxury</h3>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: dark, lineHeight: 1.7 }}>
            {review.strengths.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}

      {review.dissonances?.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <h3 style={{ fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#b03a2e', margin: '0 0 10px' }}>The dissonance (what cheapens it)</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            {review.dissonances.map((d, i) => (
              <div key={i} style={{ borderLeft: `3px solid ${sevColor[d.severity]}`, paddingLeft: 14 }}>
                <div style={{ fontSize: 14, color: dark, fontWeight: 500 }}>{d.what} <span style={{ fontSize: 10, color: sevColor[d.severity], textTransform: 'uppercase', letterSpacing: '0.5px' }}>· {d.severity}</span></div>
                {d.why && <div style={{ fontSize: 12.5, color: muted, marginTop: 2 }}>{d.why}</div>}
                {d.fix && <div style={{ fontSize: 12.5, color: dark, marginTop: 4 }}><strong style={{ fontWeight: 500 }}>Fix:</strong> {d.fix}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {review.fixes?.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <h3 style={{ fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#b8863b', margin: '0 0 10px' }}>The entrance plan (ranked)</h3>
          <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>
            {review.fixes.map((f, i) => (
              <li key={i} style={{ fontSize: 13.5, color: dark, lineHeight: 1.5 }}>
                <strong style={{ fontWeight: 600 }}>{f.title}</strong>{f.where && <span style={{ color: muted }}> · {f.where}</span>}
                {f.how && <div style={{ fontSize: 12.5, color: muted }}>{f.how}{f.agent && <span style={{ color: '#b8863b' }}> — {f.agent}</span>}</div>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {review.benchmark && (
        <p style={{ fontSize: 12.5, color: muted, marginTop: 20, paddingTop: 14, borderTop: border, fontStyle: 'italic' }}>
          ✦ {review.benchmark}
        </p>
      )}
    </div>
  );
}
