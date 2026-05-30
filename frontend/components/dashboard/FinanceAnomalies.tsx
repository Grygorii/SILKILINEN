'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL;

type Anomaly = { type: string; message: string };

/**
 * Surfaces Finance Reports anomalies (orders without shipping cost, active
 * products missing costing data, months with orders but no expenses) on the
 * main dashboard (#19) so the founder doesn't have to open Finance > Reports
 * to discover them. Renders nothing when there are no anomalies. Reuses the
 * existing /finance/reports endpoint — no new backend.
 */
export default function FinanceAnomalies() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);

  useEffect(() => {
    fetch(`${API}/api/admin/finance/reports`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then((data) => setAnomalies(Array.isArray(data?.anomalies) ? data.anomalies : []))
      .catch(() => {});
  }, []);

  if (anomalies.length === 0) return null;

  return (
    <div style={{ background: '#fff8e1', border: '1px solid #f0e0a0', padding: '14px 18px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#b07d00' }}>
          ⚠ {anomalies.length} finance anomal{anomalies.length > 1 ? 'ies' : 'y'}
        </span>
        <Link href="/admin/finance/reports" style={{ fontSize: 12, color: '#5c35a8', textDecoration: 'none' }}>Open Reports →</Link>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {anomalies.slice(0, 4).map((a, i) => (
          <li key={i} style={{ fontSize: 13, color: 'var(--dark)', lineHeight: 1.5 }}>· {a.message}</li>
        ))}
      </ul>
    </div>
  );
}
