'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL;

type Row = { slug: string; name: string; campaignId: string | null; status: string | null; orders: number; revenue: number };

/**
 * Per-product marketing pull-through (#20). Shows which campaigns drove
 * orders containing this product in the last 30 days. Renders nothing if
 * the product hasn't been attributed to any campaign — so it's invisible
 * noise-free on products that aren't being advertised.
 */
export default function ProductCampaigns({ productId }: { productId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/admin/campaigns/by-product/${productId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [productId]);

  if (!loaded || rows.length === 0) return null;

  const totalOrders = rows.reduce((s, r) => s + r.orders, 0);

  return (
    <section style={{ border: '1px solid var(--border)', padding: 20, marginTop: 16, background: 'white' }}>
      <h3 style={{ fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 400, marginBottom: 14 }}>
        Marketing — featured in {rows.length} campaign{rows.length > 1 ? 's' : ''} · {totalOrders} order{totalOrders > 1 ? 's' : ''} (30d)
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(r => (
          <div key={r.slug} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
            {r.campaignId ? (
              <Link href={`/admin/marketing/campaigns/${r.campaignId}`} style={{ color: 'var(--dark)', textDecoration: 'none', fontWeight: 500 }}>
                {r.name}
              </Link>
            ) : (
              <span style={{ color: 'var(--dark)' }}>{r.name}</span>
            )}
            <span style={{ color: 'var(--muted)' }}>{r.orders} order{r.orders > 1 ? 's' : ''} · €{r.revenue.toFixed(0)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
