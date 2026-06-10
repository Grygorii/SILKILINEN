'use client';

import { useEffect, useState, useCallback } from 'react';
import styles from '../../page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Totals = { clicks: number; impressions: number; ctr: number; position: number };
type Row = { key: string; clicks: number; impressions: number };
type PerfData = {
  configured: boolean;
  connected: boolean;
  sitemaps?: { sitemaps: number; submitted: number; indexed: number } | null;
  performance?: {
    range: { startDate: string; endDate: string; days: number };
    totals: Totals;
    topQueries: Row[];
    topPages: Row[];
  } | null;
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, minWidth: 110, border: '1px solid var(--border)', padding: '12px 14px' }}>
      <p style={{ margin: 0, fontSize: 22, fontFamily: 'Georgia, serif', color: 'var(--dark, #1a1916)' }}>{value}</p>
      <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
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
                <Stat label="Clicks" value={data.performance.totals.clicks.toLocaleString()} />
                <Stat label="Impressions" value={data.performance.totals.impressions.toLocaleString()} />
                <Stat label="CTR" value={`${(data.performance.totals.ctr * 100).toFixed(1)}%`} />
                <Stat label="Avg position" value={data.performance.totals.position.toFixed(1)} />
              </div>

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Top queries</p>
                  {data.performance.topQueries.length === 0 && <p className={styles.healthCheckDetail}>No data yet.</p>}
                  {data.performance.topQueries.map((q, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--dark, #1a1916)' }}>{q.key}</span>
                      <span style={{ color: 'var(--muted)', whiteSpace: 'nowrap', marginLeft: 12 }}>{q.clicks} clk · {q.impressions} imp</span>
                    </div>
                  ))}
                </div>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Top pages</p>
                  {data.performance.topPages.length === 0 && <p className={styles.healthCheckDetail}>No data yet.</p>}
                  {data.performance.topPages.map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--dark, #1a1916)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.key.replace(/^https?:\/\/[^/]+/, '') || '/'}</span>
                      <span style={{ color: 'var(--muted)', whiteSpace: 'nowrap', marginLeft: 12 }}>{p.clicks} clk · {p.impressions} imp</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className={styles.healthCheckDetail}>Connected, but no performance data returned yet (new sites take days to accumulate).</p>
          )}

          {data.sitemaps && (
            <p className={styles.healthCheckDetail} style={{ marginTop: 14 }}>
              Sitemap indexing: {data.sitemaps.indexed.toLocaleString()} indexed of {data.sitemaps.submitted.toLocaleString()} submitted across {data.sitemaps.sitemaps} sitemap(s).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
