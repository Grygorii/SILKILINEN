'use client';

// AI SEARCH VISIBILITY (a tab inside the SEO panel) — when a shopper asks an AI
// assistant for silk nightwear, are we in the answer? Shows whether the brand is
// named, whether silkilinen.com is cited as a source, and — most usefully —
// which competitors get recommended instead.

import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/lib/adminToast';

const API = process.env.NEXT_PUBLIC_API_URL;

const dark = 'var(--color-ink)';
const muted = 'var(--color-ink-muted)';
const border = '1px solid var(--color-line)';
const serif = "'Cormorant Garamond', Georgia, serif";
const good = 'var(--color-success)';
const gold = 'var(--color-gold)';

type Source = { title?: string; uri?: string };
type Result = {
  prompt: string; provider: string; mentioned: boolean; cited: boolean;
  competitors: string[]; sources: Source[]; excerpt?: string; error?: string;
};
type Run = {
  _id: string; runAt: string; status: 'running' | 'completed' | 'failed';
  visibility: number; mentions: number; citations: number; queries: number;
  byProvider?: Record<string, { queries: number; mentions: number; citations: number }>;
  competitorShare?: { name: string; count: number }[];
  results?: Result[];
  note?: string;
};
type Summary = { providers: { gemini: boolean; deepseek: boolean }; promptCount: number; runs: Run[] };

const PROVIDER_LABEL: Record<string, string> = { gemini: 'Gemini (with Google Search)', deepseek: 'DeepSeek (recall)', openai: 'ChatGPT' };

function timeAgo(iso?: string) {
  if (!iso) return '';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

export default function AiVisibilityPanel() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/ai-visibility`, { credentials: 'include' });
      if (res.ok) {
        const data: Summary = await res.json();
        setSummary(data);
        const latest = data.runs?.[0];
        if (latest) {
          const full = await fetch(`${API}/api/admin/ai-visibility/${latest._id}`, { credentials: 'include' });
          if (full.ok) setRun(await full.json());
        }
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function check() {
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/admin/ai-visibility/run`, { method: 'POST', credentials: 'include' });
      let data: Run = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Could not start the check');
      // Background job — poll until it finishes.
      for (let i = 0; i < 40 && data.status === 'running'; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const pr = await fetch(`${API}/api/admin/ai-visibility/${data._id}`, { credentials: 'include' });
        if (pr.ok) data = await pr.json();
      }
      setRun(data);
      if (data.status === 'running') toast('Still asking — the result will appear here shortly.', 'info');
      else if (data.note) toast(data.note, 'info');
      else toast(`Asked ${data.queries} questions · named in ${data.mentions}.`, 'success');
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Check failed', 'error');
    } finally { setBusy(false); }
  }

  const shown = showAll ? (run?.results || []) : (run?.results || []).slice(0, 8);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 13, color: muted, fontStyle: 'italic', maxWidth: 640, margin: 0 }}>
          When someone asks an AI assistant for silk nightwear, are you in the answer? This asks the questions a real
          buyer would, then records whether the brand is named, whether your site is cited as a source, and which
          competitors get recommended instead.
        </p>
        <button onClick={check} disabled={busy} style={{
          padding: '10px 20px', background: dark, color: 'var(--admin-surface)', border: 'none', whiteSpace: 'nowrap',
          cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: 'inherit', fontSize: 13, letterSpacing: '0.5px',
        }}>{busy ? 'Asking the assistants… (1–2 min)' : '✦ Check AI visibility'}</button>
      </div>

      {summary && !summary.providers.gemini && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--admin-warning-soft)', border: '1px solid var(--admin-warning-soft)', fontSize: 12.5, color: 'var(--admin-warning)' }}>
          Set <strong>GEMINI_API_KEY</strong> in Railway for grounded results — without it, answers reflect model recall
          rather than live sources, so citations can&apos;t be measured.
        </div>
      )}

      {loading ? (
        <p style={{ color: muted, fontSize: 13, marginTop: 24 }}>Loading…</p>
      ) : !run ? (
        <p style={{ color: muted, fontSize: 13, marginTop: 24 }}>
          No check yet — press <strong>Check AI visibility</strong> to ask {summary?.promptCount ?? 10} buyer questions.
        </p>
      ) : (
        <>
          {/* Headline numbers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 20 }}>
            {[
              { label: 'AI Visibility', value: `${run.visibility}%`, hint: 'answers naming the brand' },
              { label: 'Mentions', value: run.mentions, hint: `of ${run.queries} answers` },
              { label: 'Cited pages', value: run.citations, hint: 'your site used as a source' },
            ].map(c => (
              <div key={c.label} style={{ border, background: 'var(--admin-surface)', padding: '16px 18px' }}>
                <div style={{ fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: muted }}>{c.label}</div>
                <div style={{ fontFamily: serif, fontSize: 32, color: Number(run.visibility) > 0 ? good : dark, lineHeight: 1.1, marginTop: 4 }}>{c.value}</div>
                <div style={{ fontSize: 11.5, color: muted, marginTop: 2 }}>{c.hint}</div>
              </div>
            ))}
          </div>

          {run.byProvider && Object.keys(run.byProvider).length > 0 && (
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 12, fontSize: 12.5, color: muted }}>
              {Object.entries(run.byProvider).map(([k, v]) => (
                <span key={k}>{PROVIDER_LABEL[k] || k}: <strong style={{ color: dark }}>{v.mentions}</strong>/{v.queries} named · {v.citations} cited</span>
              ))}
              <span style={{ marginLeft: 'auto' }}>{timeAgo(run.runAt)}</span>
            </div>
          )}

          {/* Competitor share of voice — the actionable part */}
          {run.competitorShare && run.competitorShare.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: gold, margin: '0 0 10px' }}>
                Recommended instead of you
              </h3>
              <p style={{ fontSize: 12.5, color: muted, margin: '0 0 10px' }}>
                These are the brands the assistants name. Earning mentions where they&apos;re written about — reviews,
                round-ups, press — is what gets you into these answers.
              </p>
              <div style={{ display: 'grid', gap: 6 }}>
                {run.competitorShare.map(c => {
                  const pct = run.queries ? Math.round((c.count / run.queries) * 100) : 0;
                  return (
                    <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
                      <span style={{ width: 160, color: dark }}>{c.name}</span>
                      <div style={{ flex: 1, height: 6, background: 'var(--color-line)', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: gold }} />
                      </div>
                      <span style={{ color: muted, width: 60, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.count}×</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Per-question detail */}
          {shown.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: muted, margin: '0 0 10px' }}>Question by question</h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {shown.map((r, i) => (
                  <div key={i} style={{ border, background: 'var(--admin-surface)', padding: '12px 14px', borderLeft: `3px solid ${r.mentioned ? good : 'var(--color-line)'}` }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, color: dark }}>{r.prompt}</span>
                      <span style={{ fontSize: 10.5, color: muted, border, padding: '1px 6px' }}>{PROVIDER_LABEL[r.provider] || r.provider}</span>
                      {r.mentioned
                        ? <span style={{ fontSize: 11.5, color: good }}>✓ named{r.cited ? ' · cited' : ''}</span>
                        : <span style={{ fontSize: 11.5, color: muted }}>not named</span>}
                    </div>
                    {r.error && <p style={{ fontSize: 11.5, color: 'var(--color-danger)', margin: '4px 0 0' }}>Error: {r.error}</p>}
                    {r.competitors?.length > 0 && (
                      <p style={{ fontSize: 11.5, color: muted, margin: '4px 0 0' }}>Named instead: {r.competitors.join(', ')}</p>
                    )}
                  </div>
                ))}
              </div>
              {(run.results?.length || 0) > 8 && (
                <button onClick={() => setShowAll(!showAll)} style={{
                  marginTop: 10, padding: '6px 14px', fontSize: 12, fontFamily: 'inherit', border, background: 'var(--admin-surface)', color: muted, cursor: 'pointer',
                }}>{showAll ? 'Show less' : `Show all ${run.results?.length}`}</button>
              )}
            </div>
          )}

          <p style={{ fontSize: 11.5, color: muted, marginTop: 20, paddingTop: 12, borderTop: border, lineHeight: 1.6 }}>
            <strong>What this does and doesn&apos;t cover.</strong> Gemini answers are grounded in live Google Search, so
            citations are real sources. DeepSeek has no live search — it reflects what the model already knows.
            Google&apos;s AI Overviews and AI Mode have no public API, so they are deliberately not estimated here rather
            than guessed at. A young brand should expect low numbers at first; the value is the trend and knowing who is
            being recommended instead.
          </p>
        </>
      )}
    </div>
  );
}
