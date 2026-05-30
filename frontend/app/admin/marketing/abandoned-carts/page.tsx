'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import Link from 'next/link';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type OrderItem = { name: string; quantity: number; price: number; colour?: string; size?: string };
type RecoveryEmail = { seq: number; sentAt: string };
type AbandonedOrder = {
  _id: string;
  customerEmail: string | null;
  customerName: string | null;
  items: OrderItem[];
  total: number;
  stripeSessionId: string | null;
  createdAt: string;
  updatedAt: string;
  recoveryEmails?: RecoveryEmail[];
  recoveryUnsubscribed?: boolean;
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'Less than 1 hour ago';
  if (h === 1) return '1 hour ago';
  if (h < 24) return `${h} hours ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? '1 day ago' : `${d} days ago`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-IE', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AbandonedCartsPage() {
  const [orders, setOrders] = useState<AbandonedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [resending, setResending] = useState<string | null>(null);

  async function resendRecovery(orderId: string) {
    setResending(orderId);
    try {
      const res = await fetch(`${API}/api/orders/${orderId}/recovery-email`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': '1' },
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Failed to send'); return; }
      setOrders(prev => prev.map(o => o._id === orderId ? { ...o, recoveryEmails: data.recoveryEmails } : o));
    } catch {
      alert('Network error');
    } finally {
      setResending(null);
    }
  }

  useEffect(() => {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 3600 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

    fetch(
      `${API}/api/orders?status=pending&from=${sevenDaysAgo.toISOString().slice(0,10)}&to=${twoHoursAgo.toISOString()}&limit=100`,
      { credentials: 'include' }
    )
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed to load')))
      .then(data => {
        // Filter client-side to the exact window (API from/to may be date-only)
        const list: AbandonedOrder[] = (data.orders || data || []).filter((o: AbandonedOrder) => {
          const t = new Date(o.createdAt).getTime();
          return t >= sevenDaysAgo.getTime() && t <= twoHoursAgo.getTime();
        });
        setOrders(list);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <AdminLayout active="marketing">
      <div className={styles.header}>
        <h2>Abandoned carts</h2>
        <p className={styles.subtitle}>
          Pending checkout sessions not converted to payment, 2h–7d old.
        </p>
      </div>

      {loading && <p className={styles.muted}>Loading…</p>}
      {error && <p className={styles.error}>{error}</p>}

      {!loading && !error && orders.length === 0 && (
        <div className={styles.allClear}>
          <p>No abandoned carts right now. Beautiful.</p>
        </div>
      )}

      {orders.map(order => {
        const subtotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
        const isOpen = expanded.has(order._id);
        return (
          <div key={order._id} className={styles.card}>
            <div className={styles.cardTop}>
              <div className={styles.cardMeta}>
                <p className={styles.customer}>
                  {order.customerEmail || order.customerName || <span className={styles.anon}>anonymous</span>}
                </p>
                <p className={styles.stats}>
                  {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                  {' · '}€{subtotal.toFixed(2)}
                  {' · '}last active {relativeTime(order.updatedAt || order.createdAt)}
                </p>
                <p className={styles.created}>Created: {fmtDate(order.createdAt)}</p>
              </div>
              <div className={styles.cardActions}>
                <button
                  className={styles.expandBtn}
                  onClick={() => toggleExpand(order._id)}
                >
                  {isOpen ? 'Hide items' : 'View cart contents'}
                </button>
                <Link href={`/admin/orders/${order._id}`} className={styles.viewOrderLink}>
                  View order →
                </Link>
              </div>
            </div>

            {/* Recovery-email status (#4) — which sequence emails went out + resend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border, #eee)' }}>
              {(order.recoveryEmails || []).length === 0 ? (
                <span style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>No recovery email sent yet</span>
              ) : (
                (order.recoveryEmails || []).sort((a, b) => a.seq - b.seq).map(r => (
                  <span key={r.seq} style={{ fontSize: 11, background: '#e8f5e9', color: '#2d7d47', padding: '3px 8px' }}>
                    Email {r.seq} · {relativeTime(r.sentAt)}
                  </span>
                ))
              )}
              {order.recoveryUnsubscribed ? (
                <span style={{ fontSize: 11, color: '#c0392b' }}>Unsubscribed</span>
              ) : order.customerEmail ? (
                <button
                  onClick={() => resendRecovery(order._id)}
                  disabled={resending === order._id}
                  style={{ marginLeft: 'auto', padding: '5px 12px', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', border: '1px solid var(--dark)', background: 'white', color: 'var(--dark)' }}
                >
                  {resending === order._id ? 'Sending…' : 'Send recovery email'}
                </button>
              ) : null}
            </div>

            {isOpen && (
              <ul className={styles.itemList}>
                {order.items.map((item, i) => (
                  <li key={i} className={styles.item}>
                    <span className={styles.itemName}>{item.name}</span>
                    {(item.colour || item.size) && (
                      <span className={styles.itemVariant}>
                        {[item.colour, item.size].filter(Boolean).join(' / ')}
                      </span>
                    )}
                    <span className={styles.itemPrice}>×{item.quantity} · €{(item.price * item.quantity).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </AdminLayout>
  );
}
