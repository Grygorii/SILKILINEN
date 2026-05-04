'use client';

import { useState, useEffect, Fragment, useCallback } from 'react';
import Link from 'next/link';
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
  status: string;
  trackingNumber?: string;
  createdAt: string;
};

const STATUS_OPTIONS = ['all', 'pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded', 'failed'];

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IE', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatAddress(addr: ShippingAddress | null) {
  if (!addr) return '—';
  return [addr.city, addr.country].filter(Boolean).join(', ');
}

function formatFullAddress(addr: ShippingAddress | null) {
  if (!addr) return '—';
  return [addr.line1, addr.line2, addr.city, addr.state, addr.postalCode, addr.country]
    .filter(Boolean).join(', ');
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (search) params.set('search', search);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    params.set('page', String(page));
    params.set('limit', '50');

    try {
      const res = await fetch(`${API}/api/orders?${params}`, { credentials: 'include' });
      const data = await res.json();
      setOrders(Array.isArray(data.orders) ? data.orders : []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, from, to, page]);

  useEffect(() => { load(); }, [load]);

  function applySearch() {
    setSearch(searchInput);
    setPage(1);
  }

  function toggle(id: string) {
    setExpandedId(prev => (prev === id ? null : id));
  }

  return (
    <AdminLayout active="orders">
      <div className={styles.header}>
        <h2>Orders</h2>
        <span className={styles.count}>{total} total</span>
      </div>

      {/* Filter bar */}
      <div className={styles.filterBar}>
        <select
          className={styles.filterSelect}
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
        >
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s === 'all' ? 'All statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>

        <div className={styles.searchWrap}>
          <input
            className={styles.filterInput}
            type="text"
            placeholder="Search name or email…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applySearch()}
          />
          <button className={styles.searchBtn} onClick={applySearch}>Search</button>
        </div>

        <div className={styles.dateRange}>
          <input
            className={styles.filterInput}
            type="date"
            value={from}
            onChange={e => { setFrom(e.target.value); setPage(1); }}
          />
          <span className={styles.dateSep}>–</span>
          <input
            className={styles.filterInput}
            type="date"
            value={to}
            onChange={e => { setTo(e.target.value); setPage(1); }}
          />
        </div>

        {(statusFilter !== 'all' || search || from || to) && (
          <button className={styles.clearBtn} onClick={() => {
            setStatusFilter('all'); setSearch(''); setSearchInput('');
            setFrom(''); setTo(''); setPage(1);
          }}>Clear</button>
        )}
      </div>

      {loading ? (
        <p className={styles.loading}>Loading…</p>
      ) : orders.length === 0 ? (
        <p className={styles.empty}>No orders found.</p>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <colgroup>
                <col style={{ width: '150px' }} />
                <col style={{ width: 'auto' }} />
                <col style={{ width: '150px' }} />
                <col style={{ width: '70px' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '110px' }} />
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
                  const badgeClass = STATUS_BADGE[order.status] || styles.badgePending;

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
                                  <p className={styles.sessionId}>{order.stripeSessionId}</p>
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

                              <div className={styles.detailFooter}>
                                <Link href={`/admin/orders/${order._id}`} className={styles.viewLink}>
                                  View full order →
                                </Link>
                              </div>
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

          {pages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.pageBtn}
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >← Prev</button>
              <span className={styles.pageInfo}>Page {page} of {pages}</span>
              <button
                className={styles.pageBtn}
                disabled={page === pages}
                onClick={() => setPage(p => p + 1)}
              >Next →</button>
            </div>
          )}
        </>
      )}
    </AdminLayout>
  );
}
