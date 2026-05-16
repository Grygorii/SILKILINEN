'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';

const API = process.env.NEXT_PUBLIC_API_URL;

type FounderData = {
  weekRevenue: number;
  weekSpend: number;
  weekRoas: number | null;
  weekAdOrderCount: number;
  topProduct: { name: string; units: number; channel: string } | null;
  topCreative: { utmContent: string; orders: number } | null;
  founderBullets: string[];
  generatedAt: string | null;
};

function fmt(n: number) { return `€${n.toFixed(2)}`; }

export default function FounderPage() {
  const [data, setData] = useState<FounderData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/admin/marketing/founder`, { credentials: 'include' })
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const card = (label: string, value: string, sub?: string) => (
    <div style={{ background: 'white', border: '1px solid var(--border)', padding: '20px 22px' }}>
      <div style={{ fontSize: 10, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 400, color: 'var(--dark)' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );

  return (
    <AdminLayout>
      <div style={{ padding: 32, maxWidth: 700 }}>
        <div style={{ marginBottom: 32 }}>
          <Link href="/admin/marketing" style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none' }}>← Marketing</Link>
          <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 28, fontWeight: 400, color: 'var(--dark)', marginTop: 10, marginBottom: 4 }}>
            This week's ads
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Plain-English summary. Monday to today.</p>
        </div>

        {loading && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</p>}

        {data && !loading && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 32 }}>
              {card('Revenue from ads', fmt(data.weekRevenue))}
              {card('Ad spend', fmt(data.weekSpend))}
              {card('ROAS', data.weekRoas !== null ? `${data.weekRoas.toFixed(1)}×` : '—', 'revenue per € spent')}
              {card('Orders from ads', String(data.weekAdOrderCount))}
              {data.topProduct && card('Top product', data.topProduct.name, `${data.topProduct.units} units via ${data.topProduct.channel}`)}
              {data.topCreative && card('Top creative', data.topCreative.utmContent, `${data.topCreative.orders} orders`)}
            </div>

            {data.founderBullets.length > 0 && (
              <div style={{ background: 'white', border: '1px solid var(--border)', padding: '22px 24px', marginBottom: 28 }}>
                <div style={{ fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 16 }}>What's happening</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {data.founderBullets.map((b, i) => (
                    <li key={i} style={{ fontSize: 14, color: 'var(--dark)', lineHeight: 1.6, paddingLeft: 18, position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 0, color: 'var(--muted)', fontSize: 12, top: 3 }}>→</span>
                      {b}
                    </li>
                  ))}
                </ul>
                {data.generatedAt && (
                  <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 16, marginBottom: 0 }}>
                    Last updated {new Date(data.generatedAt).toLocaleDateString()} ·{' '}
                    <Link href="/admin/marketing" style={{ color: 'var(--muted)' }}>Regenerate in full dashboard →</Link>
                  </p>
                )}
              </div>
            )}

            {data.founderBullets.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                No analysis yet. Go to the{' '}
                <Link href="/admin/marketing" style={{ color: 'var(--dark)' }}>marketing dashboard</Link>{' '}
                and click Regenerate.
              </p>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
