'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import AdminLayout from '@/components/AdminLayout';
import StatusPill from './_components/StatusPill';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Stats = {
  revenueThisMonth: number;
  revenueLastMonth: number;
  revenueChange: number | null;
  ordersThisMonth: number;
  ordersLastMonth: number;
  ordersChange: number | null;
  aov: number;
  totalOrders: number;
  recentOrders: {
    _id: string;
    customerEmail: string;
    customerName: string;
    total: number;
    status: string;
    createdAt: string;
  }[];
  topProducts: { name: string; qty: number }[];
  salesChart: { date: string; revenue: number }[];
  geoDistribution: { country: string; count: number }[];
};

type Insight = { type: 'success' | 'warning' | 'info'; title: string; body: string };

type InsightsData = {
  today: { revenue: number; orders: number; abandonedCarts: number };
  attribution: { source: string; orders: number; revenue: number; pct: number }[];
  topProducts: { name: string; qty: number; revenue: number }[];
  insights: Insight[];
};

type HealthCheck = {
  name: string;
  label: string;
  status: string;
  detail: string;
};

type HealthData = {
  overall: string;
  checks: HealthCheck[];
  checkedAt: string;
  cached: boolean;
};

function Change({ value }: { value: number | null }) {
  if (value === null) return <span className={styles.changeMuted}>No data yet</span>;
  const sign = value >= 0 ? '+' : '';
  const cls = value >= 0 ? styles.changePos : styles.changeNeg;
  return <span className={`${styles.metricChange} ${cls}`}>{sign}{value.toFixed(1)}% vs last month</span>;
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === 'paid' ? styles.statusPaid : status === 'pending' ? styles.statusPending : styles.statusFailed;
  return <span className={`${styles.statusBadge} ${cls}`}>{status}</span>;
}

function fmt(n: number) { return `€${n.toFixed(2)}`; }

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
}

function chartTick(date: string) {
  const d = new Date(date);
  return d.getDate() % 5 === 1 ? `${d.getDate()}/${d.getMonth() + 1}` : '';
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

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

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/orders/stats`, { credentials: 'include' }).then(r => r.ok ? r.json() : null),
      fetch(`${API}/api/admin/insights`, { credentials: 'include' }).then(r => r.ok ? r.json() : null),
    ]).then(([statsData, insightsData]) => {
      setStats(statsData);
      setInsights(insightsData);
      setLoading(false);
    }).catch(() => setLoading(false));

    fetchHealth();
  }, [fetchHealth]);

  const s: Stats = stats ?? {
    revenueThisMonth: 0, revenueLastMonth: 0, revenueChange: null,
    ordersThisMonth: 0, ordersLastMonth: 0, ordersChange: null,
    aov: 0, totalOrders: 0, recentOrders: [], topProducts: [], salesChart: [], geoDistribution: [],
  };
  const maxGeo = s.geoDistribution[0]?.count ?? 1;

  return (
    <AdminLayout active="dashboard">
      <div className={styles.header}>
        <h2>Dashboard</h2>
      </div>

      {loading && <p className={styles.loading}>Loading…</p>}

      {!loading && (
        <>
          {/* ── Zone 1: Key metrics ── */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>This month</p>
            <div className={styles.metricsRow}>
              <div className={styles.metricCard}>
                <p className={styles.metricLabel}>Revenue</p>
                <p className={styles.metricValue}>{fmt(s.revenueThisMonth)}</p>
                <Change value={s.revenueChange} />
              </div>
              <div className={styles.metricCard}>
                <p className={styles.metricLabel}>Orders</p>
                <p className={styles.metricValue}>{s.ordersThisMonth}</p>
                <Change value={s.ordersChange} />
              </div>
              <div className={styles.metricCard}>
                <p className={styles.metricLabel}>Avg order value</p>
                <p className={styles.metricValue}>{fmt(s.aov)}</p>
                <span className={styles.changeMuted}>All time</span>
              </div>
              <div className={styles.metricCard}>
                <p className={styles.metricLabel}>Total orders</p>
                <p className={styles.metricValue}>{s.totalOrders}</p>
                <span className={styles.changeMuted}>All time</span>
              </div>
            </div>
          </div>

          {/* ── Zone 2: Sales chart + top products ── */}
          <div className={`${styles.section} ${styles.twoCol}`}>
            <div className={styles.card}>
              <p className={styles.cardTitle}>Revenue — last 30 days</p>
              {s.salesChart.length === 0 ? (
                <p className={styles.emptyState}>No orders yet — your first order will appear here.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={s.salesChart} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8e4de" />
                    <XAxis dataKey="date" tickFormatter={chartTick} tick={{ fontSize: 10, fill: '#9a9690' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#9a9690' }} tickFormatter={v => `€${v}`} />
                    <Tooltip formatter={(v) => [`€${Number(v ?? 0).toFixed(2)}`, 'Revenue']} labelFormatter={(label) => shortDate(String(label))} />
                    <Line type="monotone" dataKey="revenue" stroke="#2a2825" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className={styles.card}>
              <p className={styles.cardTitle}>Top products this month</p>
              {s.topProducts.length === 0 ? (
                <p className={styles.emptyState}>No sales yet this month.</p>
              ) : (
                <ul className={styles.topList}>
                  {s.topProducts.map((p, i) => (
                    <li key={i} className={styles.topItem}>
                      <span className={styles.topName}>{p.name}</span>
                      <span className={styles.topQty}>{p.qty} sold</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* ── Zone 3: Recent orders + geo ── */}
          <div className={`${styles.section} ${styles.twoCol}`}>
            <div className={styles.card}>
              <p className={styles.cardTitle}>Recent orders</p>
              {s.recentOrders.length === 0 ? (
                <p className={styles.emptyState}>No orders yet — your first order will appear here.</p>
              ) : (
                <table className={styles.miniTable}>
                  <thead>
                    <tr>
                      <th>Customer</th><th>Total</th><th>Status</th><th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.recentOrders.map(o => (
                      <tr key={o._id}>
                        <td>{o.customerName || o.customerEmail || 'Guest'}</td>
                        <td>{fmt(o.total ?? 0)}</td>
                        <td><StatusBadge status={o.status} /></td>
                        <td>{shortDate(o.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className={styles.card}>
              <p className={styles.cardTitle}>Orders by country</p>
              {s.geoDistribution.length === 0 ? (
                <p className={styles.emptyState}>No data yet.</p>
              ) : (
                <ul className={styles.geoList}>
                  {s.geoDistribution.map(g => (
                    <li key={g.country} className={styles.geoItem}>
                      <span style={{ minWidth: 32, fontSize: 12 }}>{g.country}</span>
                      <div className={styles.geoBar}>
                        <div className={styles.geoFill} style={{ width: `${(g.count / maxGeo) * 100}%` }} />
                      </div>
                      <span className={styles.geoCount}>{g.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* ── Customer insights ── */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>Customer insights</p>
            {insights && (
              <div className={styles.metricsRow} style={{ marginBottom: 16 }}>
                <div className={styles.metricCard}>
                  <p className={styles.metricLabel}>Today&apos;s revenue</p>
                  <p className={styles.metricValue}>{fmt(insights.today.revenue)}</p>
                  <span className={styles.changeMuted}>{insights.today.orders} order{insights.today.orders !== 1 ? 's' : ''}</span>
                </div>
                <div className={styles.metricCard}>
                  <p className={styles.metricLabel}>Abandoned carts</p>
                  <p className={styles.metricValue}>{insights.today.abandonedCarts}</p>
                  <span className={styles.changeMuted}>Pending &gt; 2 hours</span>
                </div>
                <div className={styles.metricCard}>
                  <p className={styles.metricLabel}>Top source</p>
                  <p className={styles.metricValue} style={{ fontSize: 22, textTransform: 'capitalize' }}>
                    {insights.attribution[0]?.source ?? '—'}
                  </p>
                  <span className={styles.changeMuted}>{insights.attribution[0]?.pct ?? 0}% of revenue</span>
                </div>
                <div className={styles.metricCard}>
                  <p className={styles.metricLabel}>Top product (30d)</p>
                  <p className={styles.metricValue} style={{ fontSize: 16, lineHeight: 1.3, marginTop: 8 }}>
                    {insights.topProducts[0]?.name ?? '—'}
                  </p>
                  <span className={styles.changeMuted}>{insights.topProducts[0] ? `${insights.topProducts[0].qty} sold` : 'No sales yet'}</span>
                </div>
              </div>
            )}
            <div className={styles.twoCol}>
              <div className={styles.card}>
                <p className={styles.cardTitle}>Traffic sources (all time)</p>
                {!insights || insights.attribution.length === 0 ? (
                  <p className={styles.emptyState}>No attributed orders yet. UTM tags on your links will populate this.</p>
                ) : (
                  <table className={styles.attrTable}>
                    <thead>
                      <tr>
                        <th>Source</th><th>Orders</th>
                        <th style={{ width: 80 }}>Revenue</th>
                        <th style={{ width: 120 }}>Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {insights.attribution.map(a => (
                        <tr key={a.source}>
                          <td style={{ textTransform: 'capitalize' }}>{a.source}</td>
                          <td>{a.orders}</td>
                          <td>{fmt(a.revenue)}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div className={styles.attrBar} style={{ width: `${a.pct}%` }} />
                              <span className={styles.attrPct}>{a.pct}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className={styles.card}>
                <p className={styles.cardTitle}>Automated insights</p>
                {!insights ? (
                  <p className={styles.emptyState}>Loading…</p>
                ) : (
                  <ul className={styles.insightsList}>
                    {insights.insights.map((ins, i) => (
                      <li key={i} className={styles.insightItem}>
                        <div className={`${styles.insightDot} ${styles[`insightDot${ins.type.charAt(0).toUpperCase() + ins.type.slice(1)}` as keyof typeof styles]}`} />
                        <div>
                          <p className={styles.insightTitle}>{ins.title}</p>
                          <p className={styles.insightBody}>{ins.body}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* ── Zone 4: System health ── */}
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
        </>
      )}
    </AdminLayout>
  );
}
