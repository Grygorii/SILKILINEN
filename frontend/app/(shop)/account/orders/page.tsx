'use client';

import { useEffect, useState } from 'react';
import styles from '../account.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Order = {
  _id: string;
  total: number;
  status: string;
  createdAt: string;
  items: { name: string }[];
};

function shortId(id: string) { return id.slice(-8).toUpperCase(); }

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/customers/me/orders`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(d => { setOrders(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <>
      <a href="/account" className={styles.back}>← Back to account</a>
      <div className={styles.pageHeader}>
        <h1>Your orders</h1>
        <p>{orders.length} order{orders.length === 1 ? '' : 's'}</p>
      </div>

      {loading && <p className={styles.loading}>Loading…</p>}

      {!loading && orders.length === 0 && (
        <div className={styles.emptyState}>
          <p>No orders yet.</p>
          <a href="/shop">Browse the collection →</a>
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
              <span className={styles.orderTotal}>€{(o.total ?? 0).toFixed(2)}</span>
              <span className={styles.orderStatus}>{o.status}</span>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
