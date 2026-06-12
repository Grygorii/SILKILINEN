'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { toast } from '@/lib/adminToast';
import Link from 'next/link';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Collection = {
  _id: string;
  name: string;
  slug: string;
  status: 'active' | 'draft' | 'archived';
  isFeatured: boolean;
  displayOrder: number;
  productCount?: number;
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

export default function AdminCollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : '';
      const res = await fetch(`${API}/api/admin/collections${qs}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load');
      setCollections(await res.json());
    } catch {
      setError('Could not load collections.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function archive(id: string) {
    if (!confirm('Archive this collection?')) return;
    const res = await fetch(`${API}/api/admin/collections/${id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) { toast('Failed to archive collection.', 'error'); return; }
    toast('Collection archived.');
    load();
  }

  async function del(id: string) {
    if (!confirm('Permanently delete this collection? This cannot be undone.')) return;
    const res = await fetch(`${API}/api/admin/collections/${id}/permanent`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) { toast('Failed to delete collection.', 'error'); return; }
    toast('Collection deleted.');
    load();
  }

  return (
    <AdminLayout>
      <div className={styles.header}>
        <h2>Collections <span className={styles.totalCount}>({collections.length})</span></h2>
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
          <Link href="/admin/collections/new" className={styles.addBtn}>+ New collection</Link>
        </div>
      </div>

      {error && <p className={styles.errorMsg}>{error}</p>}

      {loading ? (
        <p className={styles.loadingMsg}>Loading…</p>
      ) : collections.length === 0 ? (
        <p className={styles.emptyMsg}>No collections found. <Link href="/admin/collections/new">Create one?</Link></p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Status</th>
              <th>Featured</th>
              <th>Products</th>
              <th>Order</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {collections.map((c) => (
              <tr key={c._id}>
                <td>
                  <Link href={`/admin/collections/${c._id}`} className={styles.nameLink}>
                    {c.name}
                  </Link>
                </td>
                <td className={styles.slug}>{c.slug}</td>
                <td>
                  <span className={`${styles.statusPill} ${STATUS_CLASS[c.status]}`}>
                    {STATUS_LABEL[c.status]}
                  </span>
                </td>
                <td className={styles.centered}>{c.isFeatured ? '★' : '—'}</td>
                <td className={styles.centered}>{c.productCount ?? 0}</td>
                <td className={styles.centered}>{c.displayOrder}</td>
                <td>{fmtDate(c.updatedAt)}</td>
                <td>
                  <div className={styles.rowActions}>
                    <Link href={`/admin/collections/${c._id}`} className={styles.editBtn}>Edit</Link>
                    {c.status !== 'archived' && (
                      <button className={styles.archiveBtn} onClick={() => archive(c._id)}>Archive</button>
                    )}
                    <button className={styles.deleteBtn} onClick={() => del(c._id)}>Delete</button>
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
