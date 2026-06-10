'use client';

import { useEffect, useState, useCallback } from 'react';
import styles from '../../page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Rec = {
  priority: 'high' | 'medium' | 'low' | 'opportunity';
  category: string;
  title: string;
  why: string;
  action: string;
};
type AdvisorData = { generatedAt: string; recommendations: Rec[]; cached: boolean };

const PRIORITY_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  high:        { bg: '#f8d7da', color: '#721c24', label: 'DO NOW' },
  medium:      { bg: '#fff3cd', color: '#856404', label: 'SOON' },
  low:         { bg: '#e2e3e5', color: '#383d41', label: 'LATER' },
  opportunity: { bg: '#d4edda', color: '#155724', label: 'OPPORTUNITY' },
};

function PriorityBadge({ priority }: { priority: string }) {
  const p = PRIORITY_STYLE[priority] ?? PRIORITY_STYLE.low;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', fontSize: 10, fontWeight: 700,
      letterSpacing: '0.5px', borderRadius: 3, background: p.bg, color: p.color,
    }}>{p.label}</span>
  );
}

// The Advisor: a short, prioritised "what to do next to grow" list, derived
// from the live catalogue, reviews, journal and last audit. Sits at the top of
// the dashboard so there's always a clear next action.
export default function AdvisorPanel() {
  const [data, setData] = useState<AdvisorData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchAdvisor = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/advisor${force ? '?force=true' : ''}`, { credentials: 'include' });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAdvisor(); }, [fetchAdvisor]);

  return (
    <div className={styles.section}>
      <div className={styles.healthHeader}>
        <p className={styles.sectionTitle} style={{ margin: 0 }}>What to do next</p>
        <button className={styles.healthRefreshBtn} onClick={() => fetchAdvisor(true)} disabled={loading}>
          {loading ? 'Thinking…' : 'Refresh'}
        </button>
      </div>

      {loading && !data && <p className={styles.loading}>Working out your priorities…</p>}

      {data && data.recommendations.length === 0 && (
        <p className={styles.healthCheckDetail} style={{ marginTop: 12 }}>
          Nothing pressing — catalogue, content and reviews are in good shape. 🎉
        </p>
      )}

      {data && data.recommendations.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          {data.recommendations.map((r, i) => (
            <div key={i} className={styles.healthCheck}>
              <div className={styles.healthCheckTop} style={{ gap: 8 }}>
                <p className={styles.healthCheckLabel} style={{ margin: 0 }}>{r.title}</p>
                <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{r.category}</span>
                  <PriorityBadge priority={r.priority} />
                </span>
              </div>
              <p className={styles.healthCheckDetail}>{r.why}</p>
              <p className={styles.healthCheckDetail} style={{ marginTop: 6, fontStyle: 'italic' }}>→ {r.action}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
