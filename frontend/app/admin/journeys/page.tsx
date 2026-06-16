'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';

const API = process.env.NEXT_PUBLIC_API_URL;

type Funnel = { stage: string; sessions: number; ofSessions: number; ofPrev: number };
type Count = { term?: string; name?: string; count: number };
type Source = { source: string; sessions: number };
type Rev = { source: string; orders: number; revenue: number };
type Step = { type: string; page?: string; props?: Record<string, unknown>; createdAt: string };
type Journey = { sessionId: string; at: string; steps: Step[] };
type Data = {
  totalSessions: number;
  funnel: Funnel[];
  topSearches: Count[];
  topProducts: Count[];
  sources: Source[];
  revenueBySource: Rev[];
  journeys: Journey[];
};

const muted = 'var(--muted, #8a8680)';
const dark = 'var(--dark, #2a2218)';
const border = '1px solid var(--border, #e8e2d6)';
const serif = "'Cormorant Garamond', Georgia, serif";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'white', border, padding: '20px 22px' }}>
      <h2 style={{ fontFamily: serif, fontSize: 18, fontWeight: 500, color: dark, margin: '0 0 14px' }}>{title}</h2>
      {children}
    </div>
  );
}

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

export default function JourneysPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/admin/insights/journeys?days=${days}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setData(d?.error ? null : d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [days]);

  const maxFunnel = data?.funnel?.[0]?.sessions || 1;

  return (
    <AdminLayout>
      <div style={{ padding: '32px 40px', maxWidth: 1100 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <h1 style={{ fontFamily: serif, fontSize: 28, fontWeight: 300, color: dark, margin: 0, letterSpacing: '1px' }}>
              The Web — Customer Journeys
            </h1>
            <p style={{ fontSize: 13, color: muted, marginTop: 6, fontStyle: 'italic' }}>
              First-party clickstream, joined to revenue. The eye that can&rsquo;t be blocked.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[7, 30, 90].map(d => (
              <button key={d} onClick={() => setDays(d)} style={{
                padding: '6px 14px', fontSize: 12, border, cursor: 'pointer', fontFamily: 'inherit',
                background: days === d ? dark : 'white', color: days === d ? 'white' : muted,
              }}>{d}d</button>
            ))}
          </div>
        </div>

        {loading ? (
          <p style={{ fontSize: 13, color: muted, marginTop: 40 }}>Reading the web…</p>
        ) : !data ? (
          <p style={{ fontSize: 13, color: muted, marginTop: 40 }}>No data yet — events accrue as visitors browse. Check back after some live traffic.</p>
        ) : (
          <div style={{ display: 'grid', gap: 16, marginTop: 24 }}>
            {/* Funnel */}
            <Card title={`Funnel · ${data.totalSessions} sessions`}>
              <div style={{ display: 'grid', gap: 10 }}>
                {data.funnel.map((f, i) => (
                  <div key={f.stage} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 120px', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 13, color: dark }}>{f.stage}</span>
                    <div style={{ background: '#f3efe8', height: 26, position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', inset: 0, width: `${(f.sessions / maxFunnel) * 100}%`, background: 'linear-gradient(90deg,#c9a06f,#d9a6a0)', transition: 'width .4s ease' }} />
                      <span style={{ position: 'absolute', left: 8, top: 4, fontSize: 12, color: dark, fontVariantNumeric: 'tabular-nums' }}>{f.sessions}</span>
                    </div>
                    <span style={{ fontSize: 12, color: muted, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {f.ofSessions}% all{i > 0 && <span style={{ color: f.ofPrev < 40 ? '#b03a2e' : muted }}> · {f.ofPrev}% step</span>}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Top signals */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Card title="Top searches">
                {data.topSearches.length === 0 ? <p style={{ fontSize: 12, color: muted }}>No searches yet.</p> :
                  data.topSearches.map(s => (
                    <div key={s.term} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid #f3efe8' }}>
                      <span style={{ color: dark }}>{s.term}</span><span style={{ color: muted }}>{s.count}</span>
                    </div>
                  ))}
              </Card>
              <Card title="Most-clicked products">
                {data.topProducts.length === 0 ? <p style={{ fontSize: 12, color: muted }}>No card clicks yet.</p> :
                  data.topProducts.map(p => (
                    <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid #f3efe8' }}>
                      <span style={{ color: dark }}>{p.name}</span><span style={{ color: muted }}>{p.count}</span>
                    </div>
                  ))}
              </Card>
            </div>

            {/* Sources + money */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Card title="Sessions by source">
                {data.sources.map(s => (
                  <div key={s.source} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid #f3efe8' }}>
                    <span style={{ color: dark }}>{s.source || 'direct'}</span><span style={{ color: muted }}>{s.sessions}</span>
                  </div>
                ))}
              </Card>
              <Card title="Revenue by source">
                {data.revenueBySource.length === 0 ? <p style={{ fontSize: 12, color: muted }}>No revenue in range.</p> :
                  data.revenueBySource.map(r => (
                    <div key={r.source} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid #f3efe8' }}>
                      <span style={{ color: dark }}>{r.source || 'direct'} <span style={{ color: muted, fontSize: 11 }}>({r.orders})</span></span>
                      <span style={{ color: dark, fontVariantNumeric: 'tabular-nums' }}>€{Number(r.revenue || 0).toFixed(0)}</span>
                    </div>
                  ))}
              </Card>
            </div>

            {/* Real threads */}
            <Card title="Follow the thread · recent converting sessions">
              {data.journeys.length === 0 ? <p style={{ fontSize: 12, color: muted }}>No completed journeys yet.</p> :
                <div style={{ display: 'grid', gap: 14 }}>
                  {data.journeys.map(j => (
                    <div key={j.sessionId} style={{ borderLeft: '2px solid #d9a6a0', paddingLeft: 14 }}>
                      <div style={{ fontSize: 11, color: muted, marginBottom: 6 }}>session {j.sessionId.slice(0, 12)}… · purchased {timeAgo(j.at)} · {j.steps.length} steps</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {j.steps.map((st, i) => (
                          <span key={i} title={st.page} style={{
                            fontSize: 11, padding: '2px 8px', borderRadius: 2, background: st.type === 'purchase' ? '#e8f5e9' : '#f3efe8',
                            color: st.type === 'purchase' ? '#2d7d47' : dark,
                          }}>
                            {st.type}{st.props?.search_term ? `: ${st.props.search_term}` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>}
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
