'use client';

import { useEffect, useState, useCallback } from 'react';
import styles from '../../page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Totals = { clicks: number; impressions: number; ctr: number; position: number };
// `better` already accounts for position being inverted (lower is better), so
// the colour here never has to know which metric it is rendering.
type Change = { delta: number; pct: number; better: boolean; flat: boolean } | null;
type Changes = { clicks: Change; impressions: Change; ctr: Change; position: Change } | null;
type Row = { key: string; clicks: number; impressions: number };
type PerfData = {
  configured: boolean;
  connected: boolean;
  sitemaps?: { sitemaps: number; submitted: number; indexed: number } | null;
  performance?: {
    range: { startDate: string; endDate: string; days: number };
    totals: Totals;
    previous?: Totals | null;
    change?: Changes;
    topQueries: Row[];
    topPages: Row[];
  } | null;
  // Ranked and banded by the backend (utils/marketInsight): the market to act on
  // is first, and anything under the impressions floor is 'watch' — shown, but
  // never dressed up as a win.
  countries?: { code?: string; country?: string; name?: string; clicks: number; impressions: number; position: number; share?: number; band?: 'lever' | 'foothold' | 'watch' }[];
  marketHeadline?: string | null;
};

const COUNTRY: Record<string, string> = {
  gbr: 'United Kingdom', usa: 'United States', irl: 'Ireland', aus: 'Australia', can: 'Canada',
  deu: 'Germany', fra: 'France', nld: 'Netherlands', esp: 'Spain', ita: 'Italy', ind: 'India',
  are: 'UAE', sgp: 'Singapore', che: 'Switzerland', swe: 'Sweden', nor: 'Norway', dnk: 'Denmark',
  bel: 'Belgium', nzl: 'New Zealand', jpn: 'Japan', hkg: 'Hong Kong', zaf: 'South Africa',
};
const countryName = (c: string) => COUNTRY[String(c || '').toLowerCase()] || String(c || '').toUpperCase();

function Stat({ label, value, change }: { label: string; value: string; change?: Change }) {
  // A level with nothing to compare it against cannot be read: 718 impressions
  // after 300 and after 1200 are opposite situations. A move under 5% is shown
  // as flat rather than dressed up as a trend.
  const arrow = !change ? null : change.flat ? '·' : change.better ? '▲' : '▼';
  const colour = !change || change.flat
    ? 'var(--admin-ink-muted)'
    : change.better ? 'var(--admin-success)' : 'var(--admin-danger)';
  return (
    <div style={{ flex: 1, minWidth: 110, border: '1px solid var(--admin-line)', padding: '12px 14px' }}>
      <p style={{ margin: 0, fontSize: 22, fontFamily: 'Georgia, serif', color: 'var(--admin-ink)' }}>{value}</p>
      <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--admin-ink-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
      {change && (
        <p style={{ margin: '4px 0 0', fontSize: 11, color: colour }}>
          {arrow} {change.flat ? 'flat' : `${change.pct > 0 ? '+' : ''}${change.pct}%`}
          <span style={{ color: 'var(--admin-ink-muted)' }}> vs previous 28d</span>
        </p>
      )}
    </div>
  );
}

// Live Google Search Console data — search performance + sitemap indexing.
// Shows a Connect button until OAuth is completed (see docs/
// google-search-console-oauth-setup.md).
export default function SearchPerformancePanel() {
  const [data, setData] = useState<PerfData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchPerf = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/google/search-console/performance`, { credentials: 'include' });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPerf(); }, [fetchPerf]);

  // Don't render anything until we know the state (keeps the dashboard clean
  // when Search Console hasn't been set up at all).
  if (!data && !loading) return null;

  return (
    <div className={styles.section}>
      <div className={styles.healthHeader}>
        <p className={styles.sectionTitle} style={{ margin: 0 }}>Search performance</p>
        {data?.connected && data.performance && (
          <span className={styles.healthMeta}>
            {data.performance.range.days} days · to {data.performance.range.endDate}
          </span>
        )}
      </div>

      {loading && !data && <p className={styles.loading}>Loading Search Console…</p>}

      {/* Not set up at all — point to the guide. */}
      {data && !data.configured && (
        <p className={styles.healthCheckDetail} style={{ marginTop: 12 }}>
          Search Console isn’t connected. See <code>docs/google-search-console-oauth-setup.md</code>, then set the OAuth env vars in Railway.
        </p>
      )}

      {/* Configured but not yet authorised — one click. */}
      {data && data.configured && !data.connected && (
        <div style={{ marginTop: 12 }}>
          <p className={styles.healthCheckDetail} style={{ marginBottom: 10 }}>
            Connect Search Console to see live clicks, impressions and which pages Google indexed.
          </p>
          <a
            href={`${API}/api/admin/google/search-console/connect`}
            className={styles.healthRefreshBtn}
            style={{ textDecoration: 'none', display: 'inline-block' }}
          >
            Connect Search Console
          </a>
        </div>
      )}

      {/* Connected — show the live data. */}
      {data && data.connected && (
        <div style={{ marginTop: 12 }}>
          {data.performance ? (
            <>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                <Stat label="Clicks" value={data.performance.totals.clicks.toLocaleString()} change={data.performance.change?.clicks} />
                <Stat label="Impressions" value={data.performance.totals.impressions.toLocaleString()} change={data.performance.change?.impressions} />
                <Stat label="CTR" value={`${(data.performance.totals.ctr * 100).toFixed(1)}%`} change={data.performance.change?.ctr} />
                <Stat label="Avg position" value={data.performance.totals.position.toFixed(1)} change={data.performance.change?.position} />
              </div>

              <p className={styles.healthCheckDetail} style={{ marginTop: -6, marginBottom: 16, fontSize: 12 }}>
                Finalised figures — these trail Google’s live Search Console view by ~2 days (Google keeps revising the most recent days), so for the same dates the totals here can read slightly lower than the GSC dashboard. The total can also exceed the queries listed: Google hides rare/anonymised queries from the per-query list but still counts them in the total.
              </p>

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--admin-ink-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Top queries</p>
                  {data.performance.topQueries.length === 0 && <p className={styles.healthCheckDetail}>No data yet.</p>}
                  {data.performance.topQueries.map((q, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--admin-line)' }}>
                      <span style={{ color: 'var(--admin-ink)' }}>{q.key}</span>
                      <span style={{ color: 'var(--admin-ink-muted)', whiteSpace: 'nowrap', marginLeft: 12 }}>{q.clicks} clk · {q.impressions} imp</span>
                    </div>
                  ))}
                </div>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--admin-ink-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Top pages</p>
                  {data.performance.topPages.length === 0 && <p className={styles.healthCheckDetail}>No data yet.</p>}
                  {data.performance.topPages.map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--admin-line)' }}>
                      <span style={{ color: 'var(--admin-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.key.replace(/^https?:\/\/[^/]+/, '') || '/'}</span>
                      <span style={{ color: 'var(--admin-ink-muted)', whiteSpace: 'nowrap', marginLeft: 12 }}>{p.clicks} clk · {p.impressions} imp</span>
                    </div>
                  ))}
                </div>
              </div>

              {data.countries && data.countries.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--admin-ink-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>By country — where Google shows the shop</p>
                  {/* The conclusion, before the table. Ten equal tiles made the
                      biggest market look like a failure and a single impression
                      look like a win. */}
                  {data.marketHeadline && (
                    <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--admin-ink)', maxWidth: 760 }}>{data.marketHeadline}</p>
                  )}
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {data.countries.slice(0, 10).map((c, i) => {
                      const band = c.band ?? 'watch';
                      const tone = band === 'lever' ? 'var(--admin-warning)'
                        : band === 'foothold' ? 'var(--admin-success)'
                        : 'var(--admin-ink-muted)';
                      const note = band === 'lever' ? 'work this one'
                        : band === 'foothold' ? 'ranks well'
                        : 'too small to judge';
                      return (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--admin-line)', flex: '1 1 220px', minWidth: 200, opacity: band === 'watch' ? 0.6 : 1 }}>
                          <span style={{ color: 'var(--admin-ink)' }}>
                            {c.name ?? countryName(c.country ?? '')}
                            <span style={{ color: tone, fontSize: 11, marginLeft: 6 }}>· {note}</span>
                          </span>
                          <span style={{ color: 'var(--admin-ink-muted)', whiteSpace: 'nowrap', marginLeft: 12 }}>{c.clicks} clk · {c.impressions} imp · pos {c.position}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className={styles.healthCheckDetail}>Connected, but no performance data returned yet (new sites take days to accumulate).</p>
          )}

          {data.sitemaps && (
            <p className={styles.healthCheckDetail} style={{ marginTop: 14 }}>
              Sitemap: {data.sitemaps.submitted.toLocaleString()} URLs — updates and resubmits to Google automatically when pages change. Nothing to do here.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
