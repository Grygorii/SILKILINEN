'use client';

import { useEffect, useState, useCallback } from 'react';
import styles from '../account.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Order = {
  _id: string;
  total: number;
  shippingCost: number;
  status: string;
  createdAt: string;
  items: { name: string }[];
};

const STATUS_CLASS: Record<string, string> = {
  paid: styles.statusPaid,
  processing: styles.statusProcessing,
  shipped: styles.statusShipped,
  delivered: styles.statusDelivered,
  pending: styles.statusPending,
  cancelled: styles.statusCancelled,
  returned: styles.statusCancelled,
  refunded: styles.statusCancelled,
};

function shortId(id: string) { return id.slice(-8).toUpperCase(); }

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    fetch(`${API}/api/customers/me/orders`, { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error('failed'); return r.json(); })
      .then(d => { setOrders(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <a href="/account" className={styles.back}>← Back to account</a>
      <div className={styles.pageHeader}>
        <h1>Your orders</h1>
        <p>{orders.length} order{orders.length === 1 ? '' : 's'}</p>
      </div>

      {loading && <p className={styles.loading}>Loading…</p>}

      {!loading && error && (
        <div className={styles.emptyState}>
          <p>We couldn&apos;t load your orders. Please try again.</p>
          <button onClick={load} style={{ cursor: 'pointer', textDecoration: 'underline', background: 'none', border: 'none', font: 'inherit' }}>Retry</button>
        </div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className={styles.emptyState}>
          <p>Nothing to show yet.</p>
          <a href="/shop">Explore the collection</a>
        </div>
      )}

      {!loading && orders.length > 0 && (
        <div className={styles.orderList}>
          {orders.map(o => (
            <a key={o._id} href={`/account/orders/${o._id}`} className={styles.orderRow}>
              <span className={styles.orderNum}>#{shortId(o._id)}</span>
              <span className={styles.orderDate}>
                {new Date(o.createdAt).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })}
                {o.items?.[0] && ` · ${o.items[0].name}${o.items.length > 1 ? ` +${o.items.length - 1} more` : ''}`}
              </span>
              <span className={styles.orderTotal}>€{((o.total ?? 0) + (o.shippingCost ?? 0)).toFixed(2)}</span>
              <span className={`${styles.orderStatus} ${STATUS_CLASS[o.status] || styles.statusDefault}`}>
                {o.status}
              </span>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
