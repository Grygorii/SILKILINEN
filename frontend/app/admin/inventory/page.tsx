'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Row = {
  productId: string;
  productName: string;
  productStatus: string;
  colour: string | null;
  size: string | null;
  sku: string | null;
  stockLevel: number;
  lowStockThreshold: number;
  outOfStock: boolean;
};

type Data = { rows: Row[]; outOfStockCount: number; lowStockCount: number };

export default function InventoryPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/admin/products/low-stock`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch {
      setError('Could not load inventory.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <AdminLayout active="inventory">
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Inventory</h2>
          <p className={styles.subtitle}>Variants at or below their low-stock threshold — restock the exact size and colour before it sells out.</p>
        </div>
        <button className={styles.refreshBtn} onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className={styles.errorBanner}>
          <span>{error}</span>
          <button className={styles.refreshBtn} onClick={load}>Try again</button>
        </div>
      )}

      {data && (
        <div className={styles.stats}>
          <div className={`${styles.stat} ${data.outOfStockCount ? styles.statBad : ''}`}>
            <span className={styles.statNum}>{data.outOfStockCount}</span>
            <span className={styles.statLabel}>Out of stock</span>
          </div>
          <div className={`${styles.stat} ${data.lowStockCount ? styles.statWarn : ''}`}>
            <span className={styles.statNum}>{data.lowStockCount}</span>
            <span className={styles.statLabel}>Running low</span>
          </div>
        </div>
      )}

      {loading && !data && <p className={styles.muted}>Checking stock levels…</p>}

      {data && data.rows.length === 0 && (
        <div className={styles.empty}>Everything is well stocked — nothing at or below its threshold.</div>
      )}

      {data && data.rows.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Product</th>
                <th>Variant</th>
                <th>SKU</th>
                <th className={styles.numCol}>In stock</th>
                <th className={styles.numCol}>Threshold</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={`${r.productId}-${i}`} className={r.outOfStock ? styles.rowBad : ''}>
                  <td>
                    <Link href={`/admin/products/${r.productId}`} className={styles.prodLink}>{r.productName}</Link>
                  </td>
                  <td className={styles.variant}>
                    {[r.colour, r.size].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className={styles.sku}>{r.sku || '—'}</td>
                  <td className={styles.numCol}>
                    <span className={r.outOfStock ? styles.pillBad : styles.pillWarn}>{r.stockLevel}</span>
                  </td>
                  <td className={styles.numCol}>{r.lowStockThreshold}</td>
                  <td className={styles.numCol}>
                    <Link href={`/admin/products/${r.productId}`} className={styles.editLink}>Restock →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
