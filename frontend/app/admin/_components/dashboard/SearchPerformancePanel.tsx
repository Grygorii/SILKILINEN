'use client';
import { useEffect, useState } from 'react';
import styles from '../../page.module.css';
import market from './MarketTable.module.css';
const API = process.env.NEXT_PUBLIC_API_URL;
type Totals = { clicks: number; impressions: number; ctr: number; position: number };
type Row = { key: string; clicks: number; impressions: number; ctr?: number; position?: number };
type Perf = { range: { startDate: string; endDate: string; days: number }; previousRange?: { startDate: string; endDate: string }; totals: Totals; previous?: Totals | null; topQueries: Row[]; topPages: Row[]; priorities?: (Row & { kind: string; action: string; evidence: string })[] };
type Data = { configured: boolean; connected: boolean; performance?: Perf | null; marketHeadline?: string; countries?: { code?: string; country?: string; name?: string; clicks: number; impressions: number; position: number; share?: number; band?: string }[] };
function displayPath(value: string) { try { const url = new URL(value, 'https://www.silkilinen.com'); return url.pathname + url.search; } catch { return value; } }
function safePage(value: string) { try { const url = new URL(value, 'https://www.silkilinen.com'); return ['www.silkilinen.com','silkilinen.com'].includes(url.hostname) && url.protocol === 'https:' ? url.pathname + url.search : null; } catch { return null; } }
function delta(key: keyof Totals, now: number, before?: number) {
  if (before == null) return 'No comparable baseline';
  const difference = now - before, signed = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}`;
  if (key === 'ctr') return `${signed(difference * 100)} percentage points`;
  if (key === 'position') return `${signed(difference)} positions · lower is better`;
  return `${difference >= 0 ? '+' : ''}${Math.round(difference)}${before > 0 ? ` (${signed(difference / before * 100)}%)` : ''}`;
}
export default function SearchPerformancePanel() {
  const [data, setData] = useState<Data | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API}/api/admin/google/search-console/performance`, { credentials: 'include', signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error('Search performance is unavailable.'); return response.json(); })
      .then(value => { if (!controller.signal.aborted) { setData(value); setError(''); } })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Search performance is unavailable.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  const p = data?.performance;
  return <section className={styles.section}>
    <div className={styles.healthHeader}><h2 className={styles.sectionTitle}>Search performance · evidence before action</h2><button className={styles.healthRefreshBtn} onClick={() => { setLoading(true); setError(''); setRevision(value => value + 1); }} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button></div>
    {error && <p role="alert">{error} Existing figures, if shown, are from the previous successful fetch.</p>}
    {data && !data.connected && <p style={{ marginTop: 12 }}>Search Console is not connected. {data.configured && <a href={`${API}/api/admin/google/search-console/connect`}>Connect Search Console</a>}</p>}
    {p && <>
      <p style={{ fontSize: 12, margin: '10px 0 16px', color: 'var(--admin-ink-muted)' }}>{p.range.startDate}–{p.range.endDate} · {p.range.days} inclusive days · Pacific dates · finalised web-search data.{p.previousRange && <> Compared with {p.previousRange.startDate}–{p.previousRange.endDate}.</>}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>{(['clicks','impressions','ctr','position'] as const).map(key => <div key={key} style={{ flex: 1, minWidth: 145, padding: 16, border: '1px solid var(--admin-line)' }}>
        <strong style={{ fontSize: 25, fontFamily: 'Georgia, serif' }}>{key === 'ctr' ? `${(p.totals[key] * 100).toFixed(1)}%` : key === 'position' ? p.totals.impressions ? p.totals[key].toFixed(1) : '—' : p.totals[key].toLocaleString()}</strong>
        <p style={{ fontSize: 12, marginTop: 5 }}>{({ clicks: 'Google clicks', impressions: 'Search impressions', ctr: 'Click-through rate', position: 'Average position' })[key]}</p>
        <p style={{ fontSize: 11, marginTop: 4, color: 'var(--admin-ink-muted)' }}>{key === 'position' && (!p.totals.impressions || !p.previous?.impressions) ? 'No comparable position baseline' : delta(key, p.totals[key], p.previous?.[key])}</p>
      </div>)}</div>
      <p style={{ margin: '14px 0', fontSize: 13, lineHeight: 1.7 }}>Search appearances and clicks are not unique shoppers, orders or profit. Average position mixes queries, devices and countries; it is not a fixed page rank. A changing query mix can move the average without every page improving or worsening.</p>
      {!!p.priorities?.length && <div style={{ marginBlock: 24 }}><h3 style={{ fontSize: 16 }}>Pages worth reviewing next</h3><p style={{ fontSize: 12, color: 'var(--admin-ink-muted)' }}>Shopping pages first, then existing editorial traffic. The 50-impression screen is a prioritisation heuristic, not statistical proof.</p>
        {p.priorities.map(row => <article key={row.key} style={{ padding: '14px 0', borderBottom: '1px solid var(--admin-line)' }}>
          <p style={{ fontSize: 14, overflowWrap: 'anywhere' }}>{safePage(row.key) ? <a href={safePage(row.key)!} target="_blank" rel="noopener noreferrer">{displayPath(row.key)} ↗</a> : displayPath(row.key)}</p>
          <p style={{ fontSize: 12, color: 'var(--admin-ink-muted)', marginBlock: 5 }}>{row.kind} · {row.clicks} clicks / {row.impressions} impressions · CTR {((row.ctr || 0) * 100).toFixed(1)}% · avg. position {row.position?.toFixed(1) ?? '—'}</p>
          <p style={{ fontSize: 13, maxWidth: '95ch', lineHeight: 1.7 }}>{row.action}</p>
        </article>)}
      </div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>{[{ title: 'Queries', rows: p.topQueries },{ title: 'Pages', rows: p.topPages }].map(({ title, rows }) => <div key={title} style={{ flex: 1, minWidth: 250 }}>
        <h3 style={{ fontSize: 15, marginBottom: 10 }}>Top {title.toLowerCase()} by clicks</h3>
        {rows.map(row => <div key={row.key} style={{ padding: '8px 0', borderBottom: '1px solid var(--admin-line)', fontSize: 13, overflowWrap: 'anywhere' }}><p>{title === 'Pages' ? displayPath(row.key) : row.key}</p><p style={{ fontSize: 11, color: 'var(--admin-ink-muted)' }}>{row.clicks} clicks · {row.impressions} impressions · {((row.ctr ?? (row.impressions ? row.clicks / row.impressions : 0)) * 100).toFixed(1)}% CTR · position {row.position?.toFixed(1) ?? '—'}{row.impressions < 50 ? ' · small sample' : ''}</p></div>)}
      </div>)}</div>
      {!!data?.countries?.length && <div style={{ marginTop: 24 }}><h3 style={{ fontSize: 15 }}>Country visibility—not a market verdict</h3><p className={market.headline}>{data.marketHeadline}</p><div className={market.wrap}><table className={market.table}><thead><tr><th>Country</th><th>Review cue</th><th>Clicks</th><th>Impressions</th><th>CTR</th><th>Avg. position</th></tr></thead><tbody>{data.countries.slice(0,12).map((row,i) => <tr key={row.code || i}><td>{row.name || row.country}</td><td>{row.band === 'lever' ? 'Inspect query/page mix' : row.band === 'foothold' ? 'Inspect click-through' : 'Small sample'}</td><td>{row.clicks}</td><td>{row.impressions}</td><td>{(row.clicks / Math.max(1,row.impressions) * 100).toFixed(1)}%</td><td>{row.position}</td></tr>)}</tbody></table></div></div>}
      <p style={{ fontSize: 12, color: 'var(--admin-ink-muted)', lineHeight: 1.7, marginTop: 18 }}>Google may omit anonymised queries and limit returned rows. Lists need not add up to property totals. Review the same query, page, country and device before changing titles; do not bulk-rewrite successful pages from a site-wide average.</p>
    </>}
    {data?.connected && !p && !loading && <p>Search Console returned no performance report. This is not proof of zero traffic.</p>}
  </section>;
}
