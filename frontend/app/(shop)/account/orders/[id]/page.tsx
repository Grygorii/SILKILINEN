'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import styles from '../../account.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type OrderItem = { name: string; price: number; colour: string; size: string; quantity: number };
type Order = {
  _id: string;
  total: number;
  shippingCost: number;
  shippingMethod: string;
  status: string;
  createdAt: string;
  items: OrderItem[];
  shippingAddress: { line1?: string; line2?: string; city?: string; state?: string; postalCode?: string; country?: string };
};

function shortId(id: string) { return id.slice(-8).toUpperCase(); }

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
            <p>{new Date(order.createdAt).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })} · {order.status}</p>
          </div>

          <div className={styles.orderDetail}>
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
              <div className={styles.totalRow}>
                {(order.shippingCost ?? 0) > 0 && (
                  <><span>Shipping ({order.shippingMethod})</span><span>€{order.shippingCost.toFixed(2)}</span></>
                )}
              </div>
              <div className={styles.totalRow}>
                <strong>Total</strong>
                <strong>€{(order.total ?? 0).toFixed(2)}</strong>
              </div>
            </div>

            <div className={styles.section}>
              <p className={styles.sectionTitle}>Shipped to</p>
              <p style={{ fontSize: 14, color: 'var(--dark)', lineHeight: 1.6 }}>{addrStr}</p>
            </div>

            <button className={styles.reorderBtn} onClick={reorder}>
              Reorder →
            </button>
          </div>
        </>
      )}
    </>
  );
}
