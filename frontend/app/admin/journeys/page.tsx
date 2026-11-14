'use client';

import { useState, useEffect, useSyncExternalStore } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { clearAnalyticsPersistence } from '@/lib/analyticsConsent';
import { isBrowserExcludedFromAnalytics, setBrowserAnalyticsExcluded, subscribeToBrowserAnalyticsExclusion } from '@/lib/analyticsExclude';
import { getStoredSessionId } from '@/lib/track';

const API = process.env.NEXT_PUBLIC_API_URL;

type Funnel = { key: string; stage: string; sessions: number; ofSessions: number; ofPrev: number | null; reliability?: string };
type Count = { term?: string; name?: string; count: number };
type Source = { source: string; label?: string; sessions: number };
type Rev = { source: string; label?: string; orders: number; revenue: number };
type Step = { type: string; page?: string; props?: Record<string, unknown>; createdAt: string };
type Journey = { sessionId: string; at: string; steps: Step[]; outcome: 'abandoned' | 'purchased' };
type Data = {
  totalSessions: number;
  outcome: 'abandoned' | 'purchased';
  reporting: { paidOrders: number; linkedOrders: number; unlinkedOrders: number; manualOrders: number; netRevenueEUR: number };
  funnel: Funnel[];
  topSearches: Count[];
  topProducts: Count[];
  sources: Source[];
  revenueBySource: Rev[];
  journeys: Journey[];
};

const muted = 'var(--admin-ink-muted)';
const dark = 'var(--color-ink)';
const border = '1px solid var(--color-line)';
const serif = "'Cormorant Garamond', Georgia, serif";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--admin-surface)', border, padding: '20px 22px' }}>
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
  const [outcome, setOutcome] = useState<'abandoned' | 'purchased'>('abandoned');
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingBrowser, setUpdatingBrowser] = useState(false);
  const [browserMessage, setBrowserMessage] = useState('');
  const browserExcluded = useSyncExternalStore(subscribeToBrowserAnalyticsExclusion, isBrowserExcludedFromAnalytics, () => false);

  useEffect(() => {
    const controller = new AbortController();
    // ?stage= arrives from the funnel panel's "Watch a session" link, so the
    // page opens on the sessions that stopped at the step being described
    // rather than a generic list. Read from location rather than
    // useSearchParams, which would force this page into a Suspense boundary.
    const stage = new URLSearchParams(window.location.search).get('stage') || '';
    fetch(`${API}/api/admin/insights/journeys?days=${days}&outcome=${outcome}${stage ? `&stage=${encodeURIComponent(stage)}` : ''}`, { credentials: 'include', signal: controller.signal })
      .then(r => r.json())
      .then(d => {
        if (controller.signal.aborted) return;
        setData(d?.error ? null : d);
        setLoading(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setData(null);
        setLoading(false);
      });
    return () => controller.abort();
  }, [days, outcome]);

  const maxFunnel = data?.funnel?.[0]?.sessions || 1;

  function chooseOutcome(next: 'abandoned' | 'purchased') {
    if (next === outcome) return;
    setLoading(true);
    setOutcome(next);
  }

  function chooseDays(next: number) {
    if (next === days) return;
    setLoading(true);
    setDays(next);
  }

  async function updateBrowserExclusion(next: boolean) {
    if (updatingBrowser) return;
    setUpdatingBrowser(true);
    setBrowserMessage('');

    // Capture before clearing: excluding must never create an ID simply to
    // delete it, but it should remove the current browser thread if one exists.
    const sessionId = next ? getStoredSessionId() : '';
    setBrowserAnalyticsExcluded(next);

    if (!next || !sessionId) {
      clearAnalyticsPersistence();
      window.location.reload();
      return;
    }

    try {
      const response = await fetch(`${API}/api/admin/insights/journeys/exclude-browser-session`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': '1' },
        body: JSON.stringify({ sessionId }),
      });
      if (!response.ok) throw new Error('Could not remove browser activity');
      clearAnalyticsPersistence();
      window.location.reload();
    } catch {
      setBrowserMessage('Future browsing is excluded, but the earlier browser activity could not be removed. Please try again.');
      setUpdatingBrowser(false);
    }
  }

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
          <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
            <div style={{ display: 'flex', gap: 4 }} aria-label="Journey type">
              {([['abandoned', 'Incomplete'], ['purchased', 'Completed']] as const).map(([value, label]) => (
                <button key={value} onClick={() => chooseOutcome(value)} style={{
                  padding: '6px 12px', fontSize: 12, border, cursor: 'pointer', fontFamily: 'inherit',
                  background: outcome === value ? dark : 'var(--admin-surface)', color: outcome === value ? 'var(--admin-surface)' : muted,
                }}>{label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4 }} aria-label="Date range">
              {[7, 30, 90].map(d => (
                <button key={d} onClick={() => chooseDays(d)} style={{
                  padding: '6px 14px', fontSize: 12, border, cursor: 'pointer', fontFamily: 'inherit',
                  background: days === d ? dark : 'var(--admin-surface)', color: days === d ? 'var(--admin-surface)' : muted,
                }}>{d}d</button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 24, padding: '16px 18px', background: 'var(--admin-surface)', border, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20 }}>
          <div>
            <h2 style={{ fontFamily: serif, fontSize: 18, fontWeight: 500, color: dark, margin: 0 }}>
              {browserExcluded ? 'This browser is excluded' : 'Exclude this browser'}
            </h2>
            <p style={{ fontSize: 12, color: muted, lineHeight: 1.55, margin: '5px 0 0', maxWidth: 620 }}>
              {browserExcluded
                ? 'New browsing from this browser stays out of Session Replay and your store analytics. Turning it back on starts a new browser ID; removed history cannot be restored.'
                : 'Remove this browser’s recorded page views and actions, then stop new tracking here. It does not change your account, wishlist, orders, or any other device.'}
            </p>
            {browserMessage && <p role="status" style={{ fontSize: 12, color: 'var(--admin-danger)', margin: '8px 0 0' }}>{browserMessage}</p>}
          </div>
          <button
            onClick={() => updateBrowserExclusion(browserMessage ? true : !browserExcluded)}
            disabled={updatingBrowser}
            style={{ padding: '8px 13px', fontSize: 12, border, cursor: updatingBrowser ? 'wait' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', background: browserExcluded ? 'var(--admin-surface)' : dark, color: browserExcluded ? dark : 'var(--admin-surface)', opacity: updatingBrowser ? 0.7 : 1 }}
          >
            {updatingBrowser ? 'Updating…' : browserMessage ? 'Try again' : browserExcluded ? 'Include again' : 'Exclude this browser'}
          </button>
        </div>

        {loading ? (
          <p style={{ fontSize: 13, color: muted, marginTop: 40 }}>Reading the web…</p>
        ) : !data ? (
          <p style={{ fontSize: 13, color: muted, marginTop: 40 }}>No data yet — events accrue as visitors browse. Check back after some live traffic.</p>
        ) : (
          <div style={{ display: 'grid', gap: 16, marginTop: 24 }}>
            {/* Funnel */}
            <Card title={`Funnel · ${data.totalSessions} tracked browser${data.totalSessions === 1 ? '' : 's'}`}>
              <div style={{ display: 'grid', gap: 10 }}>
                {data.funnel.map((f, i) => (
                  <div key={f.stage} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 120px', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 13, color: dark }}>{f.stage}</span>
                    <div style={{ background: 'var(--admin-bg)', height: 26, position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', inset: 0, width: `${(f.sessions / maxFunnel) * 100}%`, background: 'linear-gradient(90deg,var(--admin-warning),var(--admin-danger-soft))', transition: 'width .4s ease' }} />
                      <span style={{ position: 'absolute', left: 8, top: 4, fontSize: 12, color: dark, fontVariantNumeric: 'tabular-nums' }}>{f.sessions}</span>
                    </div>
                    <span style={{ fontSize: 12, color: muted, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {f.ofSessions}% all{i > 0 && (f.ofPrev === null
                        ? <span style={{ color: muted }}> · rate unknown</span>
                        : <span style={{ color: f.ofPrev < 40 ? 'var(--admin-danger)' : muted }}> · {f.ofPrev}% step</span>)}
                    </span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 12, color: muted, lineHeight: 1.6, margin: '16px 0 0' }}>
                {data.reporting.paidOrders} paid order{data.reporting.paidOrders === 1 ? '' : 's'} (€{Number(data.reporting.netRevenueEUR || 0).toFixed(0)}) in the order ledger; {data.reporting.linkedOrders} linked to a tracked browser journey.
                {data.reporting.unlinkedOrders > 0 && ` ${data.reporting.unlinkedOrders} website order${data.reporting.unlinkedOrders === 1 ? '' : 's'} cannot be replayed because no browser link was recorded.`}
                {data.reporting.manualOrders > 0 && ` ${data.reporting.manualOrders} manual/offline order${data.reporting.manualOrders === 1 ? '' : 's'} ha${data.reporting.manualOrders === 1 ? 's' : 've'} no website journey.`}
              </p>
            </Card>

            {/* Top signals */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Card title="Top searches">
                {data.topSearches.length === 0 ? <p style={{ fontSize: 12, color: muted }}>No searches yet.</p> :
                  data.topSearches.map(s => (
                    <div key={s.term} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--admin-bg)' }}>
                      <span style={{ color: dark }}>{s.term}</span><span style={{ color: muted }}>{s.count}</span>
                    </div>
                  ))}
              </Card>
              <Card title="Most-clicked products">
                {data.topProducts.length === 0 ? <p style={{ fontSize: 12, color: muted }}>No card clicks yet.</p> :
                  data.topProducts.map(p => (
                    <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--admin-bg)' }}>
                      <span style={{ color: dark }}>{p.name}</span><span style={{ color: muted }}>{p.count}</span>
                    </div>
                  ))}
              </Card>
            </div>

            {/* Sources + money */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Card title="Tracked browsers by source">
                {data.sources.map(s => (
                  <div key={s.source} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--admin-bg)' }}>
                    <span style={{ color: dark }}>{s.label || s.source || 'Direct / unclassified'}</span><span style={{ color: muted }}>{s.sessions}</span>
                  </div>
                ))}
              </Card>
              <Card title="Ledger revenue by source">
                {data.revenueBySource.length === 0 ? <p style={{ fontSize: 12, color: muted }}>No revenue in range.</p> :
                  data.revenueBySource.map(r => (
                    <div key={r.source} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--admin-bg)' }}>
                      <span style={{ color: dark }}>{r.label || r.source || 'Unknown / unlinked'} <span style={{ color: muted, fontSize: 11 }}>({r.orders})</span></span>
                      <span style={{ color: dark, fontVariantNumeric: 'tabular-nums' }}>€{Number(r.revenue || 0).toFixed(0)}</span>
                    </div>
                  ))}
              </Card>
            </div>

            {/* Real threads */}
            <Card title={`Follow the thread · recent ${data.outcome === 'purchased' ? 'completed browser journeys' : 'incomplete journeys'}`}>
              {data.journeys.length === 0 ? <p style={{ fontSize: 12, color: muted }}>{data.outcome === 'purchased' ? 'No paid browser journeys were linked in this range.' : 'No incomplete tracked journeys matched this range.'}</p> :
                <div style={{ display: 'grid', gap: 14 }}>
                  {data.journeys.map(j => (
                    <div key={j.sessionId} style={{ borderLeft: '2px solid var(--admin-danger-soft)', paddingLeft: 14 }}>
                      <div style={{ fontSize: 11, color: muted, marginBottom: 6 }}>session {j.sessionId.slice(0, 12)}… · {j.outcome === 'purchased' ? 'paid' : 'stopped'} {timeAgo(j.at)} · {j.steps.length} steps</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {j.steps.map((st, i) => (
                          <span key={i} title={st.page} style={{
                            fontSize: 11, padding: '2px 8px', borderRadius: 2, background: st.type === 'paid_order' ? 'var(--admin-success-soft)' : 'var(--admin-bg)',
                            color: st.type === 'paid_order' ? 'var(--color-success)' : dark,
                          }}>
                            {st.type === 'paid_order' ? 'paid order' : st.type === 'purchase' ? 'purchase-page event' : st.type}{st.props?.search_term ? `: ${st.props.search_term}` : ''}
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
