'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type StatusHistoryEntry = {
  status: string;
  note: string;
  changedBy: string | null;
  timestamp: string;
};

type OrderItem = {
  name: string;
  price: number;
  colour: string;
  size: string;
  quantity: number;
};

type Order = {
  _id: string;
  stripeSessionId: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  shippingAddress: {
    line1?: string; line2?: string; city?: string;
    state?: string; postalCode?: string; country?: string;
  } | null;
  items: OrderItem[];
  total: number;
  shippingCost: number;
  shippingMethod: string | null;
  status: string;
  statusHistory: StatusHistoryEntry[];
  trackingNumber?: string;
  trackingUrl?: string;
  carrier?: string;
  shippedAt?: string;
  deliveredAt?: string;
  estimatedDelivery?: string;
  customerNote?: string;
  internalNote?: string;
  createdAt: string;
};

const VALID_STATUSES = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded'];

const STATUS_BADGE: Record<string, string> = {
  pending: styles.badgePending,
  paid: styles.badgePaid,
  processing: styles.badgeProcessing,
  shipped: styles.badgeShipped,
  delivered: styles.badgeDelivered,
  cancelled: styles.badgeCancelled,
  returned: styles.badgeCancelled,
  refunded: styles.badgeCancelled,
  failed: styles.badgeFailed,
};

function formatDate(iso: string | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IE', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatAddress(addr: Order['shippingAddress']) {
  if (!addr) return '—';
  return [addr.line1, addr.line2, addr.city, addr.state, addr.postalCode, addr.country]
    .filter(Boolean).join(', ');
}

export default function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  // Status panel state
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // Tracking panel state
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [carrier, setCarrier] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState('');
  const [trackingSaving, setTrackingSaving] = useState(false);
  const [trackingMsg, setTrackingMsg] = useState('');

  // Notes panel state
  const [customerNote, setCustomerNote] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesMsg, setNotesMsg] = useState('');

  useEffect(() => {
    fetch(`${API}/api/orders/${id}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setOrder(data);
          setNewStatus(data.status);
          setTrackingNumber(data.trackingNumber || '');
          setTrackingUrl(data.trackingUrl || '');
          setCarrier(data.carrier || '');
          setEstimatedDelivery(data.estimatedDelivery ? data.estimatedDelivery.slice(0, 10) : '');
          setCustomerNote(data.customerNote || '');
          setInternalNote(data.internalNote || '');
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  async function saveStatus() {
    if (!order || newStatus === order.status && !statusNote) return;
    setStatusSaving(true);
    setStatusMsg('');
    try {
      const res = await fetch(`${API}/api/orders/${id}/status`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, note: statusNote, sendEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setOrder(data);
        setStatusNote('');
        setStatusMsg('Status updated');
      } else {
        setStatusMsg(data.error || 'Failed');
      }
    } catch {
      setStatusMsg('Failed');
    } finally {
      setStatusSaving(false);
    }
  }

  async function saveTracking() {
    setTrackingSaving(true);
    setTrackingMsg('');
    try {
      const res = await fetch(`${API}/api/orders/${id}/tracking`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingNumber, trackingUrl, carrier, estimatedDelivery: estimatedDelivery || null }),
      });
      if (res.ok) {
        setTrackingMsg('Saved');
      } else {
        setTrackingMsg('Failed');
      }
    } catch {
      setTrackingMsg('Failed');
    } finally {
      setTrackingSaving(false);
    }
  }

  async function saveNotes() {
    setNotesSaving(true);
    setNotesMsg('');
    try {
      const res = await fetch(`${API}/api/orders/${id}/notes`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerNote, internalNote }),
      });
      if (res.ok) {
        setNotesMsg('Saved');
      } else {
        setNotesMsg('Failed');
      }
    } catch {
      setNotesMsg('Failed');
    } finally {
      setNotesSaving(false);
    }
  }

  if (loading) return <AdminLayout active="orders"><p className={styles.loading}>Loading…</p></AdminLayout>;
  if (!order) return <AdminLayout active="orders"><p className={styles.empty}>Order not found.</p></AdminLayout>;

  const shortId = String(order._id).slice(-8).toUpperCase();
  const badgeClass = STATUS_BADGE[order.status] || styles.badgePending;

  return (
    <AdminLayout active="orders">
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => router.push('/admin/orders')}>← Orders</button>
        <div className={styles.orderTitle}>
          <h2>Order #{shortId}</h2>
          <span className={`${styles.badge} ${badgeClass}`}>{order.status}</span>
        </div>
        <span className={styles.orderDate}>{formatDate(order.createdAt)}</span>
      </div>

      <div className={styles.grid}>

        {/* Left column */}
        <div className={styles.leftCol}>

          {/* Items */}
          <section className={styles.card}>
            <h3 className={styles.cardTitle}>Items</h3>
            <table className={styles.itemsTable}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Colour / Size</th>
                  <th>Qty</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, i) => (
                  <tr key={i}>
                    <td>{item.name}</td>
                    <td className={styles.muted}>{[item.colour, item.size].filter(Boolean).join(' / ') || '—'}</td>
                    <td>×{item.quantity}</td>
                    <td>€{(item.price * item.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={styles.totalsBlock}>
              <div className={styles.totalRow}>
                <span>Subtotal</span>
                <span>€{order.total?.toFixed(2) ?? '—'}</span>
              </div>
              {(order.shippingCost ?? 0) > 0 && (
                <div className={styles.totalRow}>
                  <span>Shipping{order.shippingMethod ? ` (${order.shippingMethod})` : ''}</span>
                  <span>€{order.shippingCost.toFixed(2)}</span>
                </div>
              )}
              <div className={`${styles.totalRow} ${styles.totalRowFinal}`}>
                <span>Total</span>
                <span>€{((order.total ?? 0) + (order.shippingCost ?? 0)).toFixed(2)}</span>
              </div>
            </div>
          </section>

          {/* Tracking */}
          <section className={styles.card}>
            <h3 className={styles.cardTitle}>Tracking</h3>
            <div className={styles.formGrid}>
              <label className={styles.label}>
                Tracking number
                <input className={styles.input} value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} placeholder="e.g. 1Z999AA10123456784" />
              </label>
              <label className={styles.label}>
                Carrier
                <input className={styles.input} value={carrier} onChange={e => setCarrier(e.target.value)} placeholder="e.g. DHL, An Post" />
              </label>
              <label className={`${styles.label} ${styles.fullWidth}`}>
                Tracking URL
                <input className={styles.input} value={trackingUrl} onChange={e => setTrackingUrl(e.target.value)} placeholder="https://…" />
              </label>
              <label className={styles.label}>
                Est. delivery
                <input className={styles.input} type="date" value={estimatedDelivery} onChange={e => setEstimatedDelivery(e.target.value)} />
              </label>
            </div>
            <div className={styles.cardFooter}>
              {trackingMsg && <span className={styles.saveMsg}>{trackingMsg}</span>}
              <button className={styles.saveBtn} onClick={saveTracking} disabled={trackingSaving}>
                {trackingSaving ? 'Saving…' : 'Save tracking'}
              </button>
            </div>
          </section>

          {/* Notes */}
          <section className={styles.card}>
            <h3 className={styles.cardTitle}>Notes</h3>
            <label className={styles.label}>
              Customer note
              <textarea className={styles.textarea} rows={3} value={customerNote} onChange={e => setCustomerNote(e.target.value)} placeholder="Visible to customer…" />
            </label>
            <label className={`${styles.label} ${styles.mt12}`}>
              Internal note
              <textarea className={styles.textarea} rows={3} value={internalNote} onChange={e => setInternalNote(e.target.value)} placeholder="Admin only…" />
            </label>
            <div className={styles.cardFooter}>
              {notesMsg && <span className={styles.saveMsg}>{notesMsg}</span>}
              <button className={styles.saveBtn} onClick={saveNotes} disabled={notesSaving}>
                {notesSaving ? 'Saving…' : 'Save notes'}
              </button>
            </div>
          </section>

        </div>

        {/* Right column */}
        <div className={styles.rightCol}>

          {/* Status */}
          <section className={styles.card}>
            <h3 className={styles.cardTitle}>Status</h3>
            <div className={styles.statusCurrent}>
              Current: <span className={`${styles.badge} ${badgeClass}`}>{order.status}</span>
            </div>
            <label className={styles.label}>
              Change to
              <select className={styles.input} value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                {VALID_STATUSES.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </label>
            <label className={`${styles.label} ${styles.mt12}`}>
              Note (optional)
              <input className={styles.input} value={statusNote} onChange={e => setStatusNote(e.target.value)} placeholder="e.g. Dispatched via DHL" />
            </label>
            <label className={styles.checkboxLabel}>
              <input type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)} />
              Send email notification
            </label>
            <div className={styles.cardFooter}>
              {statusMsg && <span className={styles.saveMsg}>{statusMsg}</span>}
              <button
                className={styles.saveBtn}
                onClick={saveStatus}
                disabled={statusSaving || newStatus === order.status}
              >
                {statusSaving ? 'Saving…' : 'Update status'}
              </button>
            </div>
          </section>

          {/* Customer */}
          <section className={styles.card}>
            <h3 className={styles.cardTitle}>Customer</h3>
            <div className={styles.infoList}>
              <div className={styles.infoRow}><span>Name</span><span>{order.customerName || '—'}</span></div>
              <div className={styles.infoRow}><span>Email</span><span>{order.customerEmail || '—'}</span></div>
              {order.customerPhone && <div className={styles.infoRow}><span>Phone</span><span>{order.customerPhone}</span></div>}
              <div className={styles.infoRow}><span>Address</span><span>{formatAddress(order.shippingAddress)}</span></div>
            </div>
          </section>

          {/* Status history */}
          {order.statusHistory?.length > 0 && (
            <section className={styles.card}>
              <h3 className={styles.cardTitle}>Status history</h3>
              <div className={styles.timeline}>
                {[...order.statusHistory].reverse().map((entry, i) => (
                  <div key={i} className={styles.timelineEntry}>
                    <div className={styles.timelineDot} />
                    <div className={styles.timelineBody}>
                      <div className={styles.timelineStatus}>
                        <span className={`${styles.badge} ${STATUS_BADGE[entry.status] || styles.badgePending}`}>
                          {entry.status}
                        </span>
                        <span className={styles.timelineDate}>{formatDate(entry.timestamp)}</span>
                      </div>
                      {entry.note && <p className={styles.timelineNote}>{entry.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Stripe */}
          <section className={styles.card}>
            <h3 className={styles.cardTitle}>Stripe session</h3>
            <p className={styles.sessionId}>{order.stripeSessionId}</p>
          </section>

        </div>
      </div>
    </AdminLayout>
  );
}
