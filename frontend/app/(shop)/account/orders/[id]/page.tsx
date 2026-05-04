'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import styles from '../../account.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type OrderItem = { name: string; price: number; colour: string; size: string; quantity: number };

type StatusEntry = { status: string; note: string; timestamp: string };

type Order = {
  _id: string;
  total: number;
  shippingCost: number;
  shippingMethod: string;
  status: string;
  statusHistory: StatusEntry[];
  createdAt: string;
  items: OrderItem[];
  shippingAddress: { line1?: string; line2?: string; city?: string; state?: string; postalCode?: string; country?: string } | null;
  trackingNumber?: string;
  trackingUrl?: string;
  carrier?: string;
  estimatedDelivery?: string;
  customerNote?: string;
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { addToCart } = useCart();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/customers/me/orders/${id}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { setOrder(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  function reorder() {
    if (!order) return;
    order.items.forEach(item => addToCart({ name: item.name, price: item.price, colour: item.colour, size: item.size, quantity: 1 }));
    window.dispatchEvent(new Event('openCart'));
  }

  const addr = order?.shippingAddress;
  const addrStr = addr ? [addr.line1, addr.line2, addr.city, addr.state, addr.postalCode, addr.country].filter(Boolean).join(', ') : '—';

  return (
    <>
      <a href="/account/orders" className={styles.back}>← Back to orders</a>

      {loading && <p className={styles.loading}>Loading…</p>}
      {!loading && !order && <p className={styles.emptyState}>Order not found.</p>}

      {order && (
        <>
          <div className={styles.pageHeader}>
            <h1>Order #{shortId(order._id)}</h1>
            <p>
              {formatDate(order.createdAt)} ·{' '}
              <span className={`${styles.orderStatus} ${STATUS_CLASS[order.status] || styles.statusDefault}`}>
                {order.status}
              </span>
            </p>
          </div>

          <div className={styles.orderDetail}>

            {/* Tracking */}
            {(order.trackingNumber || order.trackingUrl) && (
              <div className={styles.section}>
                <p className={styles.sectionTitle}>Tracking</p>
                <div className={styles.trackingBlock}>
                  {order.carrier && <p className={styles.trackingMeta}>{order.carrier}</p>}
                  {order.trackingUrl
                    ? <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className={styles.trackingLink}>
                        {order.trackingNumber || 'Track your package →'}
                      </a>
                    : <p className={styles.trackingLink}>{order.trackingNumber}</p>
                  }
                  {order.estimatedDelivery && (
                    <p className={styles.trackingMeta}>
                      Est. delivery: {formatDate(order.estimatedDelivery)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Items */}
            <div className={styles.section}>
              <p className={styles.sectionTitle}>Items</p>
              <div className={styles.itemsList}>
                {order.items.map((item, i) => (
                  <div key={i} className={styles.itemRow}>
                    <div>
                      <p className={styles.itemName}>{item.name}</p>
                      <p className={styles.itemMeta}>{[item.colour, item.size].filter(Boolean).join(' / ')} · qty {item.quantity}</p>
                    </div>
                    <span className={styles.itemPrice}>€{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              {(order.shippingCost ?? 0) > 0 && (
                <div className={styles.totalRow}>
                  <span>Shipping{order.shippingMethod ? ` (${order.shippingMethod})` : ''}</span>
                  <span>€{order.shippingCost.toFixed(2)}</span>
                </div>
              )}
              <div className={styles.totalRow}>
                <strong>Total</strong>
                <strong>€{((order.total ?? 0) + (order.shippingCost ?? 0)).toFixed(2)}</strong>
              </div>
            </div>

            {/* Shipping address */}
            <div className={styles.section}>
              <p className={styles.sectionTitle}>Shipped to</p>
              <p style={{ fontSize: 14, color: 'var(--dark)', lineHeight: 1.6 }}>{addrStr}</p>
            </div>

            {/* Customer note */}
            {order.customerNote && (
              <div className={styles.section}>
                <p className={styles.sectionTitle}>Note</p>
                <div className={styles.noteBlock}>{order.customerNote}</div>
              </div>
            )}

            {/* Status history */}
            {order.statusHistory?.length > 0 && (
              <div className={styles.section}>
                <p className={styles.sectionTitle}>Order updates</p>
                <div className={styles.timeline}>
                  {[...order.statusHistory].reverse().map((entry, i) => (
                    <div key={i} className={styles.timelineStep}>
                      <div className={styles.timelineDot} />
                      <div className={styles.timelineContent}>
                        <p className={styles.timelineStatus}>{entry.status}</p>
                        {entry.note && <p className={styles.timelineNote}>{entry.note}</p>}
                        <p className={styles.timelineDate}>{formatDate(entry.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button className={styles.reorderBtn} onClick={reorder}>
              Reorder →
            </button>
          </div>
        </>
      )}
    </>
  );
}
