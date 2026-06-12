'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import AdminModal from '@/components/AdminModal';
import { toast } from '@/lib/adminToast';
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

  // When archive/delete hits 409 (category still has products), the modal
  // asks where to move them — a select of active categories instead of the
  // old prompt() that made the founder type a slug from memory.
  const [reassign, setReassign] = useState<{ id: string; mode: 'archive' | 'delete'; message: string } | null>(null);
  const [reassignTarget, setReassignTarget] = useState('');
  const [reassignBusy, setReassignBusy] = useState(false);

  function deleteUrl(id: string, mode: 'archive' | 'delete', target?: string) {
    const base = `${API}/api/admin/categories/${id}${mode === 'delete' ? '/permanent' : ''}`;
    return target ? `${base}?reassignTo=${encodeURIComponent(target)}` : base;
  }

  async function removeCategory(id: string, mode: 'archive' | 'delete') {
    const confirmMsg = mode === 'archive'
      ? 'Archive this category?'
      : 'Permanently delete this category? This cannot be undone.';
    if (!confirm(confirmMsg)) return;
    const res = await fetch(deleteUrl(id, mode), { method: 'DELETE', credentials: 'include', headers: { 'X-CSRF-Token': '1' } });
    if (res.status === 409) {
      // Category still has products — open the reassignment modal.
      const data = await res.json();
      setReassignTarget('');
      setReassign({ id, mode, message: data.message || 'This category still has products.' });
      return;
    }
    if (!res.ok) {
      toast(`Failed to ${mode} category.`, 'error');
      return;
    }
    toast(mode === 'archive' ? 'Category archived.' : 'Category deleted.');
    load();
  }

  async function confirmReassign() {
    if (!reassign || !reassignTarget) return;
    setReassignBusy(true);
    try {
      const res = await fetch(deleteUrl(reassign.id, reassign.mode, reassignTarget), {
        method: 'DELETE', credentials: 'include', headers: { 'X-CSRF-Token': '1' },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast(d.error || 'Failed to reassign products.', 'error');
        return;
      }
      toast(`Products moved to "${reassignTarget}" and category ${reassign.mode === 'archive' ? 'archived' : 'deleted'}.`);
      setReassign(null);
      load();
    } catch {
      toast('Network error.', 'error');
    } finally {
      setReassignBusy(false);
    }
  }

  const archive = (id: string) => removeCategory(id, 'archive');
  const del = (id: string) => removeCategory(id, 'delete');

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
                    <button className={styles.deleteBtn} onClick={() => del(c._id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {reassign && (
        <AdminModal title="Move products first" onClose={() => setReassign(null)}>
          <p style={{ fontSize: 13, color: 'var(--muted, #6b6358)', margin: '0 0 14px', lineHeight: 1.6 }}>
            {reassign.message}
          </p>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--dark, #2a2218)' }}>
            Move its products to:
          </label>
          <select
            value={reassignTarget}
            onChange={e => setReassignTarget(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #e0d9cc', marginBottom: 18 }}
          >
            <option value="">Choose a category…</option>
            {categories
              .filter(c => c._id !== reassign.id && c.status === 'active')
              .map(c => (
                <option key={c._id} value={c.slug}>{c.label}</option>
              ))}
          </select>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              onClick={() => setReassign(null)}
              style={{ padding: '8px 14px', fontSize: 13, border: '1px solid #e0d9cc', background: '#fff', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={confirmReassign}
              disabled={!reassignTarget || reassignBusy}
              style={{
                padding: '8px 14px', fontSize: 13, border: '1px solid #2a2218',
                background: '#2a2218', color: '#fff',
                cursor: !reassignTarget || reassignBusy ? 'default' : 'pointer',
                opacity: !reassignTarget || reassignBusy ? 0.5 : 1,
              }}
            >
              {reassignBusy ? 'Moving…' : `Move & ${reassign.mode === 'archive' ? 'archive' : 'delete'}`}
            </button>
          </div>
        </AdminModal>
      )}
    </AdminLayout>
  );
}
