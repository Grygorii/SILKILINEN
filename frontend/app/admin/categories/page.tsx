'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import Link from 'next/link';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Category = {
  _id: string;
  slug: string;
  label: string;
  status: 'active' | 'archived';
  displayOrder: number;
  productCount?: number;
  updatedAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Active', archived: 'Archived',
};
const STATUS_CLASS: Record<string, string> = {
  active: styles.sActive, archived: styles.sArchived,
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : '';
      const res = await fetch(`${API}/api/admin/categories${qs}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load');
      setCategories(await res.json());
    } catch {
      setError('Could not load categories.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function archive(id: string) {
    if (!confirm('Archive this category? Existing products keep their tag — they\'ll just stop appearing in public category filters.')) return;
    await fetch(`${API}/api/admin/categories/${id}`, { method: 'DELETE', credentials: 'include' });
    load();
  }

  return (
    <AdminLayout>
      <div className={styles.header}>
        <h2>Categories <span className={styles.totalCount}>({categories.length})</span></h2>
        <div className={styles.headerActions}>
          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
          <Link href="/admin/categories/new" className={styles.addBtn}>+ New category</Link>
        </div>
      </div>

      {error && <p className={styles.errorMsg}>{error}</p>}

      {loading ? (
        <p className={styles.loadingMsg}>Loading…</p>
      ) : categories.length === 0 ? (
        <p className={styles.emptyMsg}>No categories found. <Link href="/admin/categories/new">Create one?</Link></p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Label</th>
              <th>Slug</th>
              <th>Status</th>
              <th>Products</th>
              <th>Order</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c._id}>
                <td>
                  <Link href={`/admin/categories/${c._id}`} className={styles.nameLink}>
                    {c.label}
                  </Link>
                </td>
                <td className={styles.slug}>{c.slug}</td>
                <td>
                  <span className={`${styles.statusPill} ${STATUS_CLASS[c.status]}`}>
                    {STATUS_LABEL[c.status]}
                  </span>
                </td>
                <td className={styles.centered}>{c.productCount ?? 0}</td>
                <td className={styles.centered}>{c.displayOrder}</td>
                <td>{fmtDate(c.updatedAt)}</td>
                <td>
                  <div className={styles.rowActions}>
                    <Link href={`/admin/categories/${c._id}`} className={styles.editBtn}>Edit</Link>
                    {c.status !== 'archived' && (
                      <button className={styles.archiveBtn} onClick={() => archive(c._id)}>Archive</button>
                    )}
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
