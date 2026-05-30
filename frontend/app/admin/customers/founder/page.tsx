'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';

const API = process.env.NEXT_PUBLIC_API_URL;

type Segment = { slug: string; label: string; color: string; count: number; description: string };
type Stats = {
  totalCustomers: number;
  withOrders: number;
  marketingOptIn: number;
  newThisMonth: number;
  repeatRate: number;
  avgSpend: number;
};

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', padding: '18px 22px' }}>
      <p style={{ fontSize: 10, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 6px' }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 600, color: 'var(--dark)', margin: 0 }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

export default function CustomersFounderPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/api/admin/customers?limit=1`, { credentials: 'include' });
        const data = await res.json();
        setSegments(data.segments || []);

        // Derive summary stats from segment counts
        const total = data.total || 0;
        const repeatSeg = (data.segments || []).find((s: Segment) => s.slug === 'repeat');
        const newsletterSeg = (data.segments || []).find((s: Segment) => s.slug === 'newsletter-only');
        const repeatCount = repeatSeg?.count || 0;
        const buyersCount = total - (newsletterSeg?.count || 0);

        setStats({
          totalCustomers: total,
          withOrders: buyersCount,
          marketingOptIn: 0, // not returned here — would need a dedicated endpoint
          newThisMonth: 0,   // same
          repeatRate: buyersCount > 0 ? Math.round((repeatCount / buyersCount) * 100) : 0,
          avgSpend: 0,       // same
        });
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  async function recompute() {
    setRecomputing(true);
    await fetch(`${API}/api/admin/customers/segments/recompute`, { method: 'POST', credentials: 'include' });
    setRecomputing(false);
    window.location.reload();
  }

  const SEGMENT_COLORS: Record<string, string> = {
    vip: '#5c35a8', repeat: '#2d7d47', 'first-time': '#1565c0',
    'newsletter-only': '#b07d00', recent: '#00838f', lapsed: '#e65100', 'at-risk': '#c62828',
  };

  if (loading) return <AdminLayout><div style={{ padding: 28, color: 'var(--muted)', fontSize: 13 }}>Loading…</div></AdminLayout>;

  const total = stats?.totalCustomers || 0;

  return (
    <AdminLayout>
      <div style={{ padding: '24px 28px', maxWidth: 900 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <Link href="/admin/customers" style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none' }}>← All customers</Link>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--dark)', margin: '8px 0 4px', fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
              Your customers
            </h1>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>{total} people who love Silkilinen</p>
          </div>
          <button onClick={recompute} disabled={recomputing} style={{ padding: '8px 14px', fontSize: 12, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--dark)' }}>
            {recomputing ? 'Refreshing…' : 'Refresh segments'}
          </button>
        </div>

        {/* Segment tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 32 }}>
          {segments.map(seg => {
            const pct = total > 0 ? Math.round((seg.count / total) * 100) : 0;
            return (
              <Link key={seg.slug} href={`/admin/customers?segment=${seg.slug}`} style={{ textDecoration: 'none' }}>
                <div style={{ background: 'white', border: `1px solid var(--border)`, borderLeft: `4px solid ${SEGMENT_COLORS[seg.slug] || '#ccc'}`, padding: '14px 16px' }}>
                  <p style={{ fontSize: 22, fontWeight: 600, color: SEGMENT_COLORS[seg.slug] || '#333', margin: '0 0 4px' }}>{seg.count}</p>
                  <p style={{ fontSize: 13, color: 'var(--dark)', margin: '0 0 2px', fontWeight: 500 }}>{seg.label}</p>
                  <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>{pct}% of all · {seg.description}</p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Repeat rate highlight */}
        {stats && (
          <div style={{ background: 'white', border: '1px solid var(--border)', padding: '20px 24px', marginBottom: 24 }}>
            <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px', color: 'var(--dark)' }}>Repeat purchase rate</p>
            <p style={{ fontSize: 32, fontWeight: 700, color: stats.repeatRate >= 30 ? '#2d7d47' : stats.repeatRate >= 15 ? '#b07d00' : '#c62828', margin: '0 0 6px' }}>
              {stats.repeatRate}%
            </p>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
              {stats.repeatRate >= 30
                ? 'Strong — more than 1 in 3 customers comes back.'
                : stats.repeatRate >= 15
                ? 'Growing — push loyalty to convert more repeat buyers.'
                : 'Early stage — focus on repeat campaigns and personal touches.'}
            </p>
          </div>
        )}

        {/* Quick actions */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/admin/customers/new" style={{ padding: '10px 18px', background: 'var(--dark)', color: 'white', textDecoration: 'none', fontSize: 13 }}>
            + Add customer manually
          </Link>
          <button
            onClick={async () => {
              const { downloadBlob } = await import('@/lib/api');
              try { await downloadBlob('/api/admin/customers/export/csv', 'customers.csv'); }
              catch (err) { alert(err instanceof Error ? err.message : 'Export failed'); }
            }}
            style={{ padding: '10px 18px', border: '1px solid var(--border)', color: 'var(--dark)', background: 'transparent', textDecoration: 'none', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Export all (CSV)
          </button>
          <Link href="/admin/customers?segment=lapsed" style={{ padding: '10px 18px', border: '1px solid var(--border)', color: 'var(--dark)', textDecoration: 'none', fontSize: 13 }}>
            View lapsed customers
          </Link>
        </div>
      </div>
    </AdminLayout>
  );
}
