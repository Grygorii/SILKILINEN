'use client';

import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import StatusPill from './_components/StatusPill';
import Zone1ActionItems from './_components/dashboard/Zone1ActionItems';
import Zone2Metrics from './_components/dashboard/Zone2Metrics';
import Zone3Working from './_components/dashboard/Zone3Working';
import SeoHealthPanel from './_components/dashboard/SeoHealthPanel';
import TodayStrip from './_components/dashboard/TodayStrip';
import AdvisorPanel from './_components/dashboard/AdvisorPanel';
import SearchPerformancePanel from './_components/dashboard/SearchPerformancePanel';
import FounderPulse from '@/components/dashboard/FounderPulse';
import FinanceAnomalies from '@/components/dashboard/FinanceAnomalies';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type DashData = {
  generatedAt:         string;
  cached:              boolean;
  zone1_actionItems:   unknown;
  zone2_metrics:       unknown;
  zone3_whatIsWorking: unknown;
};

type HealthCheck = { name: string; label: string; status: string; detail: string };
type HealthData  = { overall: string; checks: HealthCheck[]; checkedAt: string; cached: boolean };

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function Skeleton() {
  const box = (h: number) => (
    <div style={{ background: 'var(--cream, #f5f2ec)', height: h, border: '1px solid var(--border)', marginBottom: 12 }} />
  );
  return (
    <div>
      <div className={styles.zonesTopRow}>
        <div>{box(200)}</div>
        <div>{box(200)}</div>
      </div>
      {box(160)}
    </div>
  );
}

export default function AdminDashboard() {
  const [dashData, setDashData]     = useState<DashData | null>(null);
  const [dashLoading, setDashLoading] = useState(true);
  const [dashError, setDashError]   = useState('');

  const [health, setHealth]           = useState<HealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  // ── Health fetch (Zone 4 — unchanged from Phase 2A) ──
  const fetchHealth = useCallback(async (force = false) => {
    setHealthLoading(true);
    try {
      const url = `${API}/api/admin/health${force ? '?force=true' : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) setHealth(await res.json());
    } finally {
      setHealthLoading(false);
    }
  }, []);

  // ── Dashboard fetch (Zones 1-3) ──
  const fetchDash = useCallback(async (force = false) => {
    setDashLoading(true);
    setDashError('');
    try {
      const url = `${API}/api/admin/dashboard${force ? '?force=true' : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDashData(await res.json());
    } catch (err) {
      console.error('[dashboard] fetch error:', err);
      setDashError('Could not load dashboard data.');
    } finally {
      setDashLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDash();
    fetchHealth();

    // Auto-refresh Zones 1-3 every 5 minutes
    const interval = setInterval(() => fetchDash(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchDash, fetchHealth]);

  return (
    <AdminLayout active="dashboard">
      {/* ── Header ── */}
      <div className={styles.header}>
        <h2>Dashboard</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {dashData?.generatedAt && (
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              Updated {timeAgo(dashData.generatedAt)}{dashData.cached ? ' · cached' : ''}
            </span>
          )}
          <button
            className={styles.healthRefreshBtn}
            onClick={() => { fetchDash(true); fetchHealth(true); }}
            disabled={dashLoading}
          >
            {dashLoading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* ── Today: live pulse strip ── */}
      <TodayStrip />

      {/* ── Error banner ── */}
      {dashError && (
        <div className={styles.errorBanner}>
          <span>{dashError}</span>
          <button className={styles.healthRefreshBtn} onClick={() => fetchDash(true)}>
            Try again
          </button>
        </div>
      )}

      {/* ── Advisor: prioritised "what to do next" (Slice 3) ── */}
      <AdvisorPanel />

      {/* ── Zones 1-3 ── */}
      {dashLoading && !dashData && <Skeleton />}

      {(dashData || dashError) && (
        <>
          {/* This week's ad pulse — links to the full founder page (#17) */}
          <FounderPulse />

          {/* Finance anomalies surfaced from Reports (#19) */}
          <FinanceAnomalies />

          {/* Zones 1 + 2 side by side on desktop */}
          <div className={styles.zonesTopRow}>
            {dashData
              ? <Zone1ActionItems data={dashData.zone1_actionItems as Parameters<typeof Zone1ActionItems>[0]['data']} />
              : <div className={styles.errorCard}>Data unavailable.</div>
            }
            {dashData
              ? <Zone2Metrics data={dashData.zone2_metrics as Parameters<typeof Zone2Metrics>[0]['data']} />
              : <div className={styles.errorCard}>Data unavailable.</div>
            }
          </div>

          {/* Zone 3 full width */}
          <div className={styles.section}>
            {dashData
              ? <Zone3Working data={dashData.zone3_whatIsWorking as Parameters<typeof Zone3Working>[0]['data']} />
              : <div className={styles.errorCard}>Data unavailable.</div>
            }
          </div>
        </>
      )}

      {/* ── SEO & Merchant health — honest search/feed signal (Slice 1) ── */}
      <SeoHealthPanel />

      {/* ── Live Search Console performance (Slice 5) ── */}
      <SearchPerformancePanel />

      {/* ── Zone 4: System health — DO NOT MODIFY ── */}
      <div className={styles.section}>
        <div className={styles.healthHeader}>
          <p className={styles.sectionTitle} style={{ margin: 0 }}>System health</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {health?.checkedAt && (
              <span className={styles.healthMeta}>
                Checked {timeAgo(health.checkedAt)}{health.cached ? ' · cached' : ''}
              </span>
            )}
            <button
              className={styles.healthRefreshBtn}
              onClick={() => fetchHealth(true)}
              disabled={healthLoading}
            >
              {healthLoading ? 'Checking…' : 'Refresh'}
            </button>
          </div>
        </div>

        {healthLoading && !health && (
          <p className={styles.loading}>Running health checks…</p>
        )}

        {health && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, marginTop: 12 }}>
              <StatusPill status={health.overall} />
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                {health.overall === 'healthy'
                  ? 'All systems operational'
                  : health.overall === 'warning'
                  ? 'Some services need attention'
                  : 'Critical issues detected'}
              </span>
            </div>
            <div className={styles.healthGrid}>
              {health.checks.map(check => (
                <div key={check.name} className={styles.healthCheck}>
                  <div className={styles.healthCheckTop}>
                    <p className={styles.healthCheckLabel}>{check.label}</p>
                    <StatusPill status={check.status} />
                  </div>
                  <p className={styles.healthCheckDetail}>{check.detail}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
