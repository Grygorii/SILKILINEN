'use client';

import { useState, useEffect, Fragment } from 'react';
import AdminLayout from '@/components/AdminLayout';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type OrderItem = {
  name: string;
  price: number;
  colour: string;
  size: string;
  quantity: number;
};

type ShippingAddress = {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
};

type Order = {
  _id: string;
  stripeSessionId: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  shippingAddress: ShippingAddress | null;
  items: OrderItem[];
  total: number;
  shippingCost: number;
  shippingMethod: string | null;
  status: 'pending' | 'paid' | 'failed';
  createdAt: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatAddress(addr: ShippingAddress | null) {
  if (!addr) return '—';
  return [addr.city, addr.country].filter(Boolean).join(', ');
}

function formatFullAddress(addr: ShippingAddress | null) {
  if (!addr) return '—';
  return [addr.line1, addr.line2, addr.city, addr.state, addr.postalCode, addr.country]
    .filter(Boolean)
    .join(', ');
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/api/orders`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setOrders(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function toggle(id: string) {
    setExpandedId(prev => (prev === id ? null : id));
  }

  return (
    <AdminLayout active="orders">
      <div className={styles.header}>
        <h2>Orders</h2>
        <span className={styles.count}>{orders.length} total</span>
      </div>

      {loading ? (
        <p className={styles.loading}>Loading…</p>
      ) : orders.length === 0 ? (
        <p className={styles.empty}>No orders yet.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <colgroup>
              <col style={{ width: '160px' }} />
              <col style={{ width: 'auto' }} />
              <col style={{ width: '160px' }} />
              <col style={{ width: '80px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '90px' }} />
              <col style={{ width: '40px' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Ship to</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => {
                const expanded = expandedId === order._id;
                const badgeClass = order.status === 'paid'
                  ? styles.badgePaid
                  : order.status === 'failed'
                    ? styles.badgeFailed
                    : styles.badgePending;

                return (
                  <Fragment key={order._id}>
                    <tr
                      className={`${styles.summaryRow} ${expanded ? styles.summaryRowOpen : ''}`}
                      onClick={() => toggle(order._id)}
                    >
                      <td className={styles.dateCell}>{formatDate(order.createdAt)}</td>
                      <td>
                        <span className={styles.customerName}>{order.customerName || '—'}</span>
                        <span className={styles.customerEmail}>{order.customerEmail || '—'}</span>
                      </td>
                      <td>{formatAddress(order.shippingAddress)}</td>
                      <td>{order.items.length} {order.items.length === 1 ? 'item' : 'items'}</td>
                      <td>€{((order.total ?? 0) + (order.shippingCost ?? 0)).toFixed(2)}</td>
                      <td>
                        <span className={`${styles.badge} ${badgeClass}`}>{order.status}</span>
                      </td>
                      <td className={styles.chevronCell}>
                        <svg
                          className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`}
                          width="14" height="14" viewBox="0 0 24 24"
                          fill="none" stroke="currentColor" strokeWidth="2"
                          strokeLinecap="round" strokeLinejoin="round"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </td>
                    </tr>

                    {expanded && (
                      <tr className={styles.detailRow}>
                        <td colSpan={7}>
                          <div className={styles.detail}>

                            <div className={styles.detailMeta}>
                              <div className={styles.metaBlock}>
                                <h4>Customer</h4>
                                <p>{order.customerName || '—'}</p>
                                <p>{order.customerEmail || '—'}</p>
                                {order.customerPhone && <p>{order.customerPhone}</p>}
                              </div>
                              <div className={styles.metaBlock}>
                                <h4>Shipping address</h4>
                                <p>{formatFullAddress(order.shippingAddress)}</p>
                              </div>
                              <div className={styles.metaBlock}>
                                <h4>Order</h4>
                                <p>Items — €{order.total?.toFixed(2) ?? '—'}</p>
                                {(order.shippingCost ?? 0) > 0 && (
                                  <p>Shipping{order.shippingMethod ? ` (${order.shippingMethod})` : ''} — €{order.shippingCost.toFixed(2)}</p>
                                )}
                                <p>Total — €{((order.total ?? 0) + (order.shippingCost ?? 0)).toFixed(2)}</p>
                                <p>Status — {order.status}</p>
                                <p className={styles.sessionId}>
                                  {order.stripeSessionId}
                                </p>
                              </div>
                            </div>

                            <table className={styles.itemsTable}>
                              <thead>
                                <tr>
                                  <th>Product</th>
                                  <th>Colour</th>
                                  <th>Size</th>
                                  <th>Qty</th>
                                  <th>Unit price</th>
                                  <th>Line total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {order.items.map((item, i) => (
                                  <tr key={i}>
                                    <td>{item.name}</td>
                                    <td>{item.colour || '—'}</td>
                                    <td>{item.size || '—'}</td>
                                    <td>{item.quantity}</td>
                                    <td>€{Number(item.price).toFixed(2)}</td>
                                    <td>€{(item.price * item.quantity).toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>

                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
