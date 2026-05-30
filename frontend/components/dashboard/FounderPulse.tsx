'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL;

type FounderData = {
  weekRevenue: number;
  weekSpend: number;
  weekRoas: number | null;
  weekAdOrderCount: number;
};

/**
 * Compact "this week's ads" strip for the main dashboard — the same KPIs as
 * the /admin/marketing/founder page, surfaced one level up so the founder
 * doesn't have to tab-hop to see ad performance. Links to the full page.
 * Renders nothing if there's no ad activity (zero spend + zero revenue).
 */
export default function FounderPulse() {
  const [data, setData] = useState<FounderData | null>(null);

  useEffect(() => {
    fetch(`${API}/api/admin/marketing/founder`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return null;
  if (data.weekRevenue === 0 && data.weekSpend === 0) return null;

  const cell = (label: string, value: string) => (
    <div style={{ flex: 1, minWidth: 110 }}>
      <div style={{ fontSize: 10, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontFamily: "'Cormorant Garamond', Georgia, serif", color: 'var(--dark)' }}>{value}</div>
    </div>
  );

  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', padding: '16px 20px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--muted)' }}>This week&apos;s ads</span>
        <Link href="/admin/marketing/founder" style={{ fontSize: 12, color: '#5c35a8', textDecoration: 'none' }}>Details →</Link>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {cell('Revenue', `€${data.weekRevenue.toFixed(0)}`)}
        {cell('Spend', `€${data.weekSpend.toFixed(0)}`)}
        {cell('ROAS', data.weekRoas !== null ? `${data.weekRoas.toFixed(1)}×` : '—')}
        {cell('Orders', String(data.weekAdOrderCount))}
      </div>
    </div>
  );
}
