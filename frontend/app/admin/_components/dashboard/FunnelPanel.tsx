'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Card from '../Card';
type Stage = { key: string; label: string; count: number; lost: number | null; rate: number | null; enteredFrom: number; progressed: number; why?: string; fix?: { label: string; href: string } | null };
type Funnel = { days: number; stages: Stage[]; biggestLeak: Stage | null; overallConversion: number | null; blindSpots: { key: string; label: string; note: string }[]; evidence: { summary: { orders: number; netRevenueEUR: number; linkedOrders: number; unlinkedOrders: number }; quality: { browsers: number; withInteraction: number } }; methodology: string };
const API = process.env.NEXT_PUBLIC_API_URL;
export default function FunnelPanel() {
  const [days, setDays] = useState(14), [reload, setReload] = useState(0);
  const [result, setResult] = useState<{ forDays: number; data?: Funnel; error?: string }>({ forDays: 0 });
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API}/api/admin/dashboard/funnel?days=${days}`, { credentials: 'include', signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error('Journey data could not be loaded.'); return response.json(); })
      .then(data => { if (!controller.signal.aborted) setResult({ forDays: days, data }); })
      .catch(error => { if (!controller.signal.aborted) setResult({ forDays: days, error: error.message }); });
    return () => controller.abort();
  }, [days, reload]);
  const data = result.forDays === days ? result.data : undefined;
  const max = Math.max(1, ...(data?.stages.map(stage => stage.count) || [])), summary = data?.evidence?.summary;
  return <Card title="Customer journey · measurement & activity" action={<div style={{ display: 'flex', gap: 6 }}>{[7,14,30].map(value => <button key={value} onClick={() => setDays(value)} aria-pressed={days === value} style={{ padding: '5px 10px', font: 'inherit', fontSize: 12, border: '1px solid var(--admin-line)', background: days === value ? 'var(--admin-ink)' : 'transparent', color: days === value ? 'var(--admin-surface)' : 'var(--admin-ink)', cursor: 'pointer' }}>{value}d</button>)}</div>}>
    {result.forDays === days && result.error ? <p role="alert">{result.error} <button onClick={() => setReload(n => n + 1)}>Retry</button></p> : !data ? <p>Loading journey evidence…</p> : <>
      {summary && <div style={{ padding: 16, background: 'var(--admin-bg)', marginBottom: 16, fontSize: 14, lineHeight: 1.8 }}>
        <strong>{summary.orders} ledger purchase{summary.orders === 1 ? '' : 's'} · €{summary.netRevenueEUR.toFixed(2)} net order value</strong><br />
        {summary.linkedOrders} linked to tracked browsers; {summary.unlinkedOrders} website orders without a matching browser in this period.
        <br />{data.evidence.quality.withInteraction} browser IDs recorded a click, search or shopping interaction.
        <br /><strong>{data.overallConversion == null ? 'Purchase conversion: unknown — insufficient linkage or sample.' : `Observed linked-browser conversion: ${data.overallConversion}%`}</strong>
      </div>}
      {data.blindSpots?.map(gap => <p key={gap.key} style={{ padding: '10px 14px', borderLeft: '3px solid var(--admin-info)', background: 'var(--admin-info-soft)', fontSize: 13, marginBottom: 10 }}><strong>{gap.label}:</strong> {gap.note}</p>)}
      {data.biggestLeak && <p style={{ fontSize: 13, padding: 14, background: 'var(--admin-warning-soft)' }}><strong>Review candidate:</strong> {data.biggestLeak.lost} tracked browsers had no later “{data.biggestLeak.label}” recorded. {data.biggestLeak.why} {data.biggestLeak.fix && <Link href={data.biggestLeak.fix.href}>{data.biggestLeak.fix.label} →</Link>}</p>}
      <ol style={{ listStyle: 'none', margin: '20px 0', padding: 0 }}>{data.stages.map(stage => <li key={stage.key} style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}><span>{stage.label}</span><strong>{stage.key === 'purchased' && summary?.unlinkedOrders ? `${stage.count} linked · ${summary.orders} ledger orders` : stage.count}</strong></div>
        <div style={{ height: 5, background: 'var(--admin-bg)', marginTop: 5 }}><div style={{ width: `${stage.count / max * 100}%`, height: '100%', background: 'var(--admin-ink)' }} /></div>
        {stage.key !== 'sessions' && <p style={{ fontSize: 11, color: 'var(--admin-ink-muted)', marginTop: 3 }}>{stage.rate == null ? 'Step progression is unknown.' : `${stage.progressed}/${stage.enteredFrom} previous-step browsers reached this step later in the period.${stage.enteredFrom < 30 ? ' Small sample; not a reliable trend.' : ''}`}</p>}
      </li>)}</ol>
      <p style={{ fontSize: 12, color: 'var(--admin-ink-muted)', lineHeight: 1.7 }}>{data.methodology} This is not a count of verified people. Missing events and automation can affect the numbers; a missing event does not prove an abandoned purchase.</p>
    </>}
  </Card>;
}
