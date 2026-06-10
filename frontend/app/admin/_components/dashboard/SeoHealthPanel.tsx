'use client';

import { useEffect, useState, useCallback } from 'react';
import StatusPill from '../StatusPill';
import styles from '../../page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type SeoCheck = { name: string; label: string; status: string; detail: string; advice?: string };
type SeoData = { overall: string; checks: SeoCheck[]; checkedAt: string; cached: boolean };

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Honest SEO / Merchant health. Unlike the infra "System health" block, these
// checks probe the live public site and the catalogue from Google's angle, so
// the panel goes yellow/red when Search Console or Merchant would complain —
// each failing check carries a one-line "what to do".
export default function SeoHealthPanel() {
  const [data, setData] = useState<SeoData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSeo = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/seo-health${force ? '?force=true' : ''}`, { credentials: 'include' });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSeo(); }, [fetchSeo]);

  return (
    <div className={styles.section}>
      <div className={styles.healthHeader}>
        <p className={styles.sectionTitle} style={{ margin: 0 }}>SEO &amp; Merchant health</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {data?.checkedAt && (
            <span className={styles.healthMeta}>
              Checked {timeAgo(data.checkedAt)}{data.cached ? ' · cached' : ''}
            </span>
          )}
          <button className={styles.healthRefreshBtn} onClick={() => fetchSeo(true)} disabled={loading}>
            {loading ? 'Checking…' : 'Refresh'}
          </button>
        </div>
      </div>

      {loading && !data && <p className={styles.loading}>Running SEO checks…</p>}

      {data && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, marginTop: 12 }}>
            <StatusPill status={data.overall} />
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>
              {data.overall === 'healthy'
                ? 'Search & feed signals look good'
                : data.overall === 'warning'
                ? 'Some search/feed issues to tidy up'
                : 'Search or feed issues need attention'}
            </span>
          </div>
          <div className={styles.healthGrid}>
            {data.checks.map(check => (
              <div key={check.name} className={styles.healthCheck}>
                <div className={styles.healthCheckTop}>
                  <p className={styles.healthCheckLabel}>{check.label}</p>
                  <StatusPill status={check.status} />
                </div>
                <p className={styles.healthCheckDetail}>{check.detail}</p>
                {check.advice && check.status !== 'healthy' && (
                  <p className={styles.healthCheckDetail} style={{ marginTop: 6, fontStyle: 'italic' }}>
                    → {check.advice}
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
