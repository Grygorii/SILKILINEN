'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import Link from 'next/link';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Bundle = {
  _id: string;
  name: string;
  slug: string;
  status: 'active' | 'draft' | 'archived';
  isFeatured: boolean;
  displayOrder: number;
  discountPercent: number;
  productCount?: number;
  originalTotal?: number;
  bundlePrice?: number;
  updatedAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Active', draft: 'Draft', archived: 'Archived',
};
const STATUS_CLASS: Record<string, string> = {
  active: styles.sActive, draft: styles.sDraft, archived: styles.sArchived,
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

export default function AdminBundlesPage() {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : '';
      const res = await fetch(`${API}/api/admin/bundles${qs}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load');
      setBundles(await res.json());
    } catch {
      setError('Could not load bundles.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function archive(id: string) {
    if (!confirm('Archive this bundle?')) return;
    await fetch(`${API}/api/admin/bundles/${id}`, { method: 'DELETE', credentials: 'include' });
    load();
  }

  async function del(id: string) {
    if (!confirm('Permanently delete this bundle? This cannot be undone.')) return;
    const res = await fetch(`${API}/api/admin/bundles/${id}/permanent`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) { alert('Failed to delete bundle.'); return; }
    load();
  }

  return (
    <AdminLayout>
      <div className={styles.header}>
        <h2>Bundles <span className={styles.totalCount}>({bundles.length})</span></h2>
        <div className={styles.headerActions}>
          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
          <Link href="/admin/bundles/new" className={styles.addBtn}>+ New bundle</Link>
        </div>
      </div>

      {error && <p className={styles.errorMsg}>{error}</p>}

      {loading ? (
        <p className={styles.loadingMsg}>Loading…</p>
      ) : bundles.length === 0 ? (
        <p className={styles.emptyMsg}>No bundles yet. <Link href="/admin/bundles/new">Create one?</Link></p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Status</th>
              <th>Featured</th>
              <th>Products</th>
              <th>Discount</th>
              <th>Price</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {bundles.map((b) => (
              <tr key={b._id}>
                <td>
                  <Link href={`/admin/bundles/${b._id}`} className={styles.nameLink}>{b.name}</Link>
                </td>
                <td className={styles.slug}>{b.slug}</td>
                <td>
                  <span className={`${styles.statusPill} ${STATUS_CLASS[b.status]}`}>
                    {STATUS_LABEL[b.status]}
                  </span>
                </td>
                <td className={styles.centered}>{b.isFeatured ? '★' : '—'}</td>
                <td className={styles.centered}>{b.productCount ?? 0}</td>
                <td className={styles.centered}>{b.discountPercent}%</td>
                <td>
                  {b.originalTotal != null && b.bundlePrice != null ? (
                    <>
                      <span className={styles.priceCurrent}>€{b.bundlePrice.toFixed(2)}</span>
                      {b.originalTotal > b.bundlePrice && (
                        <span className={styles.priceWas}>€{b.originalTotal.toFixed(2)}</span>
                      )}
                    </>
                  ) : '—'}
                </td>
                <td>{fmtDate(b.updatedAt)}</td>
                <td>
                  <div className={styles.rowActions}>
                    <Link href={`/admin/bundles/${b._id}`} className={styles.editBtn}>Edit</Link>
                    {b.status !== 'archived' && (
                      <button className={styles.archiveBtn} onClick={() => archive(b._id)}>Archive</button>
                    )}
                    <button className={styles.deleteBtn} onClick={() => del(b._id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminLayout>
  );
}
