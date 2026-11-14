'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type PulseData = {
  todayRevenue: number;
  todayOrders: number;
  todayAdOrders: number;
  todaySpend: number;
  todayRoas: number | null;
  summaryLine: string;
  activeCampaignCount: number;
};

type CampaignRow = {
  _id: string;
  name: string;
  slug: string;
  channel: string;
  status: string;
  spend: number;
  budget: number;
  orders: number;
  revenue: number;
  roas: number | null;
  lastCreative: string | null;
};

type Analysis = { bullets: string[]; generatedAt: string } | null;

type DashData = {
  pulse: PulseData;
  analysis: Analysis;
  campaigns: CampaignRow[];
  topAdProducts: { name: string; units: number; revenue: number }[];
  topCreatives: { utmContent: string; orders: number; revenue: number }[];
  revenueByChannel: { channel: string; revenue: number }[];
  geoCountries: { country: string; visitors: number }[];
};

type SubscriberSummary = {
  total: number;
  unsubscribed: number;
  auditExcluded: number;
  bySource: { source: string; count: number }[];
};

type Subscriber = {
  email: string;
  source: string;
  subscribedAt: string;
  discountCodeUsed: boolean;
};

function fmt(n: number) {
  return `€${n.toFixed(2)}`;
}

function roasColor(r: number | null) {
  if (r === null) return {};
  if (r >= 3) return { color: 'var(--color-success)' };
  if (r >= 1.5) return {};
  return { color: 'var(--color-danger)' };
}

function statusPill(status: string) {
  const map: Record<string, string> = {
    active: styles.pillActive,
    paused: styles.pillPaused,
    ended:  styles.pillEnded,
    draft:  styles.pillDraft,
  };
  return `${styles.pill} ${map[status] || styles.pillDraft}`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function sourceLabel(source: string) {
  const labels: Record<string, string> = {
    website: 'Website',
    popup: 'Popup',
    'style-finder': 'Style Finder',
  };
  return labels[source] || source || 'Unknown';
}

export default function MarketingDashboardPage() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [subs, setSubs] = useState<SubscriberSummary | null>(null);
  const [subscriberList, setSubscriberList] = useState<Subscriber[] | null>(null);
  const [subscriberLoading, setSubscriberLoading] = useState(false);
  const [subscriberError, setSubscriberError] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/admin/marketing/subscribers`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null)).then(d => d && setSubs(d)).catch(() => {});
  }, []);

  async function exportSubs() {
    setExporting(true);
    setSubscriberError('');
    try {
      const { downloadBlob } = await import('@/lib/api');
      await downloadBlob('/api/admin/marketing/subscribers/export.csv', 'subscribers.csv', { method: 'GET' });
    } catch {
      setSubscriberError('The subscriber export could not be downloaded. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  async function toggleSubscriberList() {
    if (subscriberList) {
      setSubscriberList(null);
      return;
    }
    setSubscriberLoading(true);
    setSubscriberError('');
    try {
      const res = await fetch(`${API}/api/admin/marketing/subscribers/recent`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Could not load subscribers');
      const payload = await res.json() as { subscribers?: Subscriber[] };
      setSubscriberList(payload.subscribers || []);
    } catch {
      setSubscriberError('The private subscriber list could not be loaded. Please try again.');
    } finally {
      setSubscriberLoading(false);
    }
  }

  const fetchDash = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/marketing/dashboard`, { credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDash(); }, [fetchDash]);

  async function regenerate() {
    setRegenerating(true);
    try {
      const res = await fetch(`${API}/api/admin/marketing/analysis/regenerate`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchDash();
    } catch { /* silently fail */ }
    finally { setRegenerating(false); }
  }

  if (loading) return <AdminLayout><div className={styles.page}><p style={{ color: 'var(--admin-ink-muted)', fontSize: 13 }}>Loading…</p></div></AdminLayout>;
  if (error)   return <AdminLayout><div className={styles.page}><p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p></div></AdminLayout>;
  if (!data)   return null;

  const { pulse, analysis, campaigns, topAdProducts, topCreatives, revenueByChannel, geoCountries } = data;

  return (
    <AdminLayout>
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h1>Marketing</h1>
            <p>Ad performance, campaigns, and attribution</p>
          </div>
          <div className={styles.headerActions}>
            <Link href="/admin/marketing/founder" className={`${styles.btn} ${styles.btnOutline}`}>
              Founder view
            </Link>
            <Link href="/admin/marketing/utm-builder" className={`${styles.btn} ${styles.btnOutline}`}>
              UTM builder
            </Link>
            <Link href="/admin/marketing/campaigns/new" className={styles.btn}>
              + New campaign
            </Link>
          </div>
        </div>

        {/* Email subscribers — captured leads, now usable (count + export) */}
        {subs && (
          <div style={{ border: '1px solid var(--color-line)', background: 'var(--color-bg)', padding: '16px 20px', margin: '0 0 20px', borderRadius: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--admin-ink-muted)' }}>Email subscribers</p>
                <p style={{ margin: '4px 0 0', fontSize: 26, fontFamily: 'Georgia, serif', color: 'var(--color-ink)' }}>{subs.total.toLocaleString()}</p>
              </div>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
                {subs.bySource.slice(0, 4).map(s => (
                  <span key={s.source} style={{ fontSize: 12.5, color: 'var(--admin-ink-muted)' }}>{sourceLabel(s.source)}: <strong style={{ color: 'var(--color-ink)' }}>{s.count}</strong></span>
                ))}
                <button onClick={toggleSubscriberList} disabled={!subs.total || subscriberLoading} style={{ padding: '8px 14px', background: 'var(--color-bg)', color: 'var(--color-ink)', border: '1px solid var(--color-ink)', cursor: subs.total && !subscriberLoading ? 'pointer' : 'default', fontSize: 12, letterSpacing: '0.5px', borderRadius: 3, opacity: subs.total ? 1 : 0.5 }}>
                  {subscriberLoading ? 'Loading…' : subscriberList ? 'Hide contacts' : 'View contacts'}
                </button>
                <button onClick={exportSubs} disabled={!subs.total || exporting} style={{ padding: '8px 14px', background: 'var(--color-ink)', color: 'var(--color-bg)', border: 'none', cursor: subs.total && !exporting ? 'pointer' : 'default', fontSize: 12, letterSpacing: '0.5px', borderRadius: 3, opacity: subs.total ? 1 : 0.5 }}>{exporting ? 'Exporting…' : 'Export CSV'}</button>
              </div>
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--admin-ink-muted)' }}>
              Active capture records — not proof that an inbox belongs to a real shopper. New sign-ups should be email-confirmed before using them for advertising. {subs.auditExcluded > 0 ? `${subs.auditExcluded} internal audit record${subs.auditExcluded === 1 ? ' is' : 's are'} excluded.` : ''}{subs.unsubscribed > 0 ? ` ${subs.unsubscribed} unsubscribed record${subs.unsubscribed === 1 ? ' is' : 's are'} excluded.` : ''}
            </p>
            {subscriberError && <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--color-danger)' }}>{subscriberError}</p>}
            {subscriberList && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--color-line)', overflowX: 'auto' }}>
                <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--admin-ink-muted)' }}>Private list — latest {subscriberList.length} active capture record{subscriberList.length === 1 ? '' : 's'}.</p>
                <table style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr>
                      {['Email', 'Source', 'Joined', 'Welcome offer'].map(heading => (
                        <th key={heading} scope="col" style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-line)', color: 'var(--admin-ink-muted)', fontSize: 10, letterSpacing: '0.8px', textAlign: 'left', textTransform: 'uppercase' }}>{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {subscriberList.map(subscriber => (
                      <tr key={subscriber.email}>
                        <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--color-line)', color: 'var(--color-ink)' }}>{subscriber.email}</td>
                        <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--color-line)', color: 'var(--admin-ink-muted)' }}>{sourceLabel(subscriber.source)}</td>
                        <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--color-line)', color: 'var(--admin-ink-muted)' }}>{subscriber.subscribedAt ? new Date(subscriber.subscribedAt).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                        <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--color-line)', color: 'var(--admin-ink-muted)' }}>{subscriber.discountCodeUsed ? 'Used' : 'Not used'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Pulse band */}
        <div className={styles.pulseBand}>
          <div className={styles.pulseCell}>
            <div className={styles.pulseLabel}>Today revenue</div>
            <div className={styles.pulseValue}>{fmt(pulse.todayRevenue)}</div>
          </div>
          <div className={styles.pulseCell}>
            <div className={styles.pulseLabel}>Today orders</div>
            <div className={styles.pulseValue}>{pulse.todayOrders}</div>
            <div className={styles.pulseSub}>{pulse.todayAdOrders} from ads</div>
          </div>
          <div className={styles.pulseCell}>
            <div className={styles.pulseLabel}>Today ad spend</div>
            <div className={styles.pulseValue}>{fmt(pulse.todaySpend)}</div>
          </div>
          <div className={styles.pulseCell}>
            <div className={styles.pulseLabel}>Today ROAS</div>
            <div className={styles.pulseValue} style={roasColor(pulse.todayRoas)}>
              {pulse.todayRoas !== null ? `${pulse.todayRoas.toFixed(1)}×` : '—'}
            </div>
          </div>
          <div className={styles.pulseCell}>
            <div className={styles.pulseLabel}>Active campaigns</div>
            <div className={styles.pulseValue}>{pulse.activeCampaignCount}</div>
          </div>
        </div>

        {/* Summary line */}
        <div className={styles.summaryLine}>{pulse.summaryLine}</div>

        {/* Today's Read */}
        <div className={styles.analysisBlock}>
          <div className={styles.analysisHeader}>
            <span className={styles.analysisTitle}>Today's Read</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {analysis && (
                <span className={styles.analysisMeta}>Generated {timeAgo(analysis.generatedAt)}</span>
              )}
              <button className={styles.regenerateBtn} onClick={regenerate} disabled={regenerating}>
                {regenerating ? 'Regenerating…' : 'Regenerate'}
              </button>
            </div>
          </div>
          {analysis ? (
            <ul className={styles.analysisBullets}>
              {analysis.bullets.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--admin-ink-muted)' }}>
              No analysis yet. Click Regenerate to generate today's read.
            </p>
          )}
        </div>

        {/* Campaigns table */}
        <p className={styles.sectionLabel}>Campaigns</p>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Channel</th>
              <th>Status</th>
              <th>Spend (30d)</th>
              <th>Revenue (30d)</th>
              <th>ROAS</th>
              <th>Orders</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 ? (
              <tr><td colSpan={7} className={styles.tableEmpty}>No campaigns yet. <Link href="/admin/marketing/campaigns/new">Create one →</Link></td></tr>
            ) : campaigns.map(c => (
              <tr key={c._id}>
                <td><Link href={`/admin/marketing/campaigns/${c._id}`}>{c.name}</Link></td>
                <td>{c.channel}</td>
                <td><span className={statusPill(c.status)}>{c.status}</span></td>
                <td>{fmt(c.spend)}</td>
                <td>{fmt(c.revenue)}</td>
                <td style={roasColor(c.roas)}>{c.roas !== null ? `${c.roas.toFixed(1)}×` : '—'}</td>
                <td>{c.orders}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Bottom grids */}
        <div className={styles.bottomGrid}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Top ad products (30d)</div>
            {topAdProducts.length === 0
              ? <p style={{ fontSize: 13, color: 'var(--admin-ink-muted)' }}>No ad-attributed orders yet.</p>
              : topAdProducts.map((p, i) => (
                <div key={i} className={styles.miniRow}>
                  <span>{p.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--admin-ink-muted)' }}>{p.units} units · {fmt(p.revenue)}</span>
                </div>
              ))
            }
          </div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Top creatives (30d)</div>
            {topCreatives.length === 0
              ? <p style={{ fontSize: 13, color: 'var(--admin-ink-muted)' }}>No creative data yet.</p>
              : topCreatives.map((c, i) => (
                <div key={i} className={styles.miniRow}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{c.utmContent}</span>
                  <span style={{ fontSize: 11, color: 'var(--admin-ink-muted)' }}>{c.orders} orders · {fmt(c.revenue)}</span>
                </div>
              ))
            }
          </div>
        </div>

        <div className={styles.bottomGrid}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Revenue by channel (30d)</div>
            {revenueByChannel.length === 0
              ? <p style={{ fontSize: 13, color: 'var(--admin-ink-muted)' }}>No data yet.</p>
              : revenueByChannel.map((c, i) => (
                <div key={i} className={styles.miniRow}>
                  <span>{c.channel}</span>
                  <span>{fmt(c.revenue)}</span>
                </div>
              ))
            }
          </div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Visitor countries (30d, paid traffic)</div>
            {geoCountries.length === 0
              ? <p style={{ fontSize: 13, color: 'var(--admin-ink-muted)' }}>No geo data yet.</p>
              : geoCountries.map((g, i) => (
                <div key={i} className={styles.miniRow}>
                  <span>{g.country}</span>
                  <span className={styles.miniRowLabel}>{g.visitors} visitors</span>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
