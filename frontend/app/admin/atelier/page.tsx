'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { toast } from '@/lib/adminToast';

const API = process.env.NEXT_PUBLIC_API_URL;

type Dissonance = { what: string; why: string; fix: string; severity: 'high' | 'medium' | 'low' };
type Fix = { title: string; where: string; how: string; agent: string };
type Room = { name: string; path: string; score: number; verdict: string; dissonances: Dissonance[]; usedScreenshot: boolean; loadMs: number };
type Dimension = { name: string; score: number; summary: string; findings: string[] };
type Review = {
  _id: string; status?: 'running' | 'completed' | 'failed';
  wowScore: number; weakestRoom: string; verdict: string; firstImpression: string;
  strengths: string[]; dissonances: Dissonance[]; fixes: Fix[]; benchmark: string;
  dimensions: Dimension[]; rooms: Room[]; usedVision: boolean; usedFallback: boolean; createdAt: string;
};

const dark = 'var(--dark, #2a2218)';
const muted = 'var(--muted, #8a8680)';
const border = '1px solid var(--border, #e8e2d6)';
const serif = "'Cormorant Garamond', Georgia, serif";
const sevColor = { high: '#b03a2e', medium: '#b8863b', low: muted } as const;
const scoreColor = (s: number) => (s >= 8 ? '#2d7d47' : s >= 6 ? '#b8863b' : '#b03a2e');

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
  const [alt, setAlt] = useState<{ weak: number; total: number } | null>(null);
  const [altBusy, setAltBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/admin/atelier`, { credentials: 'include' });
      const data = await res.json();
      setVisionReady(data.visionReady !== false);
      if (Array.isArray(data.reviews)) { setHistory(data.reviews); setReview(r => r || data.reviews[0] || null); }
    } catch { /* ignore */ }
    try {
      const ar = await fetch(`${API}/api/admin/atelier/alt`, { credentials: 'include' });
      if (ar.ok) { const a = await ar.json(); setAlt({ weak: a.weak ?? 0, total: a.total ?? 0 }); }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runAlt(force: boolean) {
    setAltBusy(true);
    try {
      const res = await fetch(`${API}/api/admin/atelier/alt`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Alt text failed');
      if (!data.ran) toast(data.note || 'Set GEMINI_API_KEY to enable this.', 'info');
      else if (data.updated > 0) toast(`Wrote alt text for ${data.updated} photo${data.updated === 1 ? '' : 's'} across ${data.productsTouched} product${data.productsTouched === 1 ? '' : 's'}${data.hitLimit ? ' — run again to finish the rest.' : '.'}`, 'success');
      else toast('Every product photo already has descriptive alt text. ✦', 'success');
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Alt text failed', 'error');
    } finally { setAltBusy(false); }
  }

  async function runReview() {
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/admin/atelier/review`, { method: 'POST', credentials: 'include' });
      let data: Review = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Review failed');
      // Background job — poll until it leaves 'running'.
      if (data.status === 'running') {
        for (let i = 0; i < 60 && data.status === 'running'; i++) {
          await new Promise(r => setTimeout(r, 5000));
          const pr = await fetch(`${API}/api/admin/atelier/${data._id}`, { credentials: 'include' });
          if (pr.ok) data = await pr.json();
        }
      }
      setReview(data); load();
      if (data.status === 'running') toast('Still walking — the report will appear here when it lands.', 'info');
      else if (data.usedFallback && !data.usedVision) toast(data.verdict || 'Set GEMINI_API_KEY to enable the Atelier.', 'info');
      else toast('The Maison Director has walked the whole house.', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Review failed', 'error');
    } finally { setBusy(false); }
  }

  return (
    <AdminLayout>
      <div style={{ padding: '32px 40px', maxWidth: 980 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <h1 style={{ fontFamily: serif, fontSize: 28, fontWeight: 300, color: dark, margin: 0, letterSpacing: '1px' }}>The Atelier</h1>
            <p style={{ fontSize: 13, color: muted, marginTop: 6, fontStyle: 'italic' }}>
              A luxury creative director with real eyes — it walks every room of the site and judges the whole experience. A villa is only as good as its worst room.
            </p>
          </div>
          <button onClick={runReview} disabled={busy} style={{
            padding: '11px 22px', background: dark, color: 'white', border: 'none',
            cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: 'inherit', fontSize: 13, letterSpacing: '0.5px', whiteSpace: 'nowrap',
          }}>{busy ? 'Walking the house… (1–3 min)' : '✦ Review the whole house'}</button>
        </div>

        {!visionReady && (
          <div style={{ marginTop: 20, padding: '14px 18px', background: '#fdf6e9', border: '1px solid #e6d9bf', fontSize: 13, color: '#8a6d2f' }}>
            The Atelier has no eyes yet — set <strong>GEMINI_API_KEY</strong> in Railway (the same key as Image Studio) to let it see the site.
          </div>
        )}

        {/* Alt text — the Atelier looks at each product photo and writes its alt
            text. This is also run automatically by the Site Audit; the button
            is here for when you want to do a pass on its own. */}
        {visionReady && (
          <div style={{ marginTop: 20, padding: '14px 18px', background: '#fff', border, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 13.5, color: dark, fontWeight: 500 }}>Photo alt text</div>
              <div style={{ fontSize: 12.5, color: muted, marginTop: 3 }}>
                {alt
                  ? (alt.weak > 0
                      ? `${alt.weak} of ${alt.total} product photos need descriptive alt text.`
                      : `All ${alt.total} product photos have alt text. ✦`)
                  : 'The Atelier looks at each photo and writes its alt text — for accessibility and SEO.'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => runAlt(false)} disabled={altBusy} style={{
                padding: '9px 18px', background: alt && alt.weak > 0 ? dark : '#fff', color: alt && alt.weak > 0 ? '#fff' : dark,
                border, cursor: altBusy ? 'default' : 'pointer', opacity: altBusy ? 0.6 : 1, fontFamily: 'inherit', fontSize: 12.5, letterSpacing: '0.4px', whiteSpace: 'nowrap',
              }}>{altBusy ? 'Looking…' : (alt && alt.weak > 0 ? `✦ Write the ${alt.weak} missing` : '✦ Write missing alt text')}</button>
              {alt && alt.total > 0 && (
                <button onClick={() => runAlt(true)} disabled={altBusy} title="Rewrite every alt line, not just the missing ones" style={{
                  padding: '9px 14px', background: '#fff', color: muted, border, cursor: altBusy ? 'default' : 'pointer', opacity: altBusy ? 0.6 : 1, fontFamily: 'inherit', fontSize: 12.5, whiteSpace: 'nowrap',
                }}>Redo all</button>
              )}
            </div>
          </div>
        )}

        {review && <ReviewView review={review} />}

        {history.length > 1 && (
          <div style={{ marginTop: 30 }}>
            <h2 style={{ fontFamily: serif, fontSize: 18, color: dark, marginBottom: 10 }}>Past walk-throughs</h2>
            <div style={{ display: 'grid', gap: 8 }}>
              {history.map(h => (
                <button key={h._id} onClick={() => setReview(h)} style={{ textAlign: 'left', background: 'white', border, padding: '10px 14px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: 13, color: dark }}>{h.verdict || 'House review'}</span>
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
  return (
    <div style={{ background: 'white', border, padding: '24px 26px', marginTop: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
        {score > 0 && (
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontFamily: serif, fontSize: 48, fontWeight: 400, color: scoreColor(score), lineHeight: 1 }}>{score}<span style={{ fontSize: 20, color: muted }}>/10</span></div>
            <div style={{ fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: muted, marginTop: 4 }}>The whole house</div>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 280 }}>
          <p style={{ fontFamily: serif, fontSize: 20, color: dark, margin: 0, lineHeight: 1.35 }}>{review.verdict}</p>
          {review.firstImpression && <p style={{ fontSize: 13.5, color: muted, marginTop: 8, lineHeight: 1.6 }}>{review.firstImpression}</p>}
          {review.weakestRoom && (
            <p style={{ fontSize: 13, color: '#b03a2e', marginTop: 8 }}>⚠ Weakest room — fix this first: <strong>{review.weakestRoom}</strong></p>
          )}
        </div>
      </div>

      {/* The four craft pillars */}
      {review.dimensions?.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginTop: 22 }}>
          {review.dimensions.map((d, i) => (
            <div key={i} style={{ border, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, letterSpacing: '1.2px', textTransform: 'uppercase', color: muted }}>{d.name}</span>
                <span style={{ fontFamily: serif, fontSize: 22, fontWeight: 500, color: scoreColor(d.score) }}>{d.score || '–'}<span style={{ fontSize: 11, color: muted }}>/10</span></span>
              </div>
              {d.summary && <p style={{ fontSize: 11.5, color: muted, margin: '4px 0 0', lineHeight: 1.45 }}>{d.summary}</p>}
              {d.findings?.length > 0 && (
                <ul style={{ margin: '6px 0 0', paddingLeft: 15, fontSize: 11.5, color: dark, lineHeight: 1.5 }}>
                  {d.findings.slice(0, 3).map((f, j) => <li key={j}>{f}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Every room, scored */}
      {review.rooms?.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <h3 style={{ fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: muted, margin: '0 0 10px' }}>Room by room</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {review.rooms.map((r, i) => (
              <div key={i} style={{ border, padding: '12px 14px', background: r.name === review.weakestRoom ? '#fdf3f1' : '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: serif, fontSize: 20, fontWeight: 500, color: scoreColor(r.score), minWidth: 42 }}>{r.score || '–'}<span style={{ fontSize: 11, color: muted }}>/10</span></span>
                  <span style={{ fontSize: 14, color: dark, fontWeight: 500 }}>{r.name}</span>
                  <a href={`https://www.silkilinen.com${r.path}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#b8863b' }}>open →</a>
                  {!r.usedScreenshot && <span style={{ fontSize: 10, color: muted, fontStyle: 'italic' }}>(content-only)</span>}
                  {r.loadMs > 2500 && <span style={{ fontSize: 10, color: '#b03a2e' }}>· slow {Math.round(r.loadMs / 100) / 10}s</span>}
                </div>
                {r.verdict && <p style={{ fontSize: 12.5, color: muted, margin: '4px 0 0', lineHeight: 1.5 }}>{r.verdict}</p>}
                {r.dissonances?.length > 0 && (
                  <ul style={{ margin: '6px 0 0', paddingLeft: 16, fontSize: 12.5, lineHeight: 1.6 }}>
                    {r.dissonances.map((d, j) => (
                      <li key={j} style={{ color: dark }}><span style={{ color: sevColor[d.severity] }}>●</span> {d.what}{d.fix && <span style={{ color: muted }}> → {d.fix}</span>}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {review.strengths?.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <h3 style={{ fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#2d7d47', margin: '0 0 8px' }}>What already reads as luxury</h3>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: dark, lineHeight: 1.7 }}>
            {review.strengths.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}

      {review.fixes?.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <h3 style={{ fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#b8863b', margin: '0 0 10px' }}>The house plan (ranked)</h3>
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
        <p style={{ fontSize: 12.5, color: muted, marginTop: 20, paddingTop: 14, borderTop: border, fontStyle: 'italic' }}>✦ {review.benchmark}</p>
      )}
    </div>
  );
}
