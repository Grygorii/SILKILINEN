'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Product = {
  _id: string;
  name: string;
  price: number;
  category: string;
  colours: string[];
  status: 'draft' | 'active' | 'sold_out' | 'archived';
  totalStock: number;
  inStock: boolean;
  image: string;
  images: { url: string; isPrimary: boolean }[];
  updatedAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  draft: 'Draft',
  sold_out: 'Sold out',
  archived: 'Archived',
};

const STATUS_CLASS: Record<string, string> = {
  active: styles.sActive,
  draft: styles.sDraft,
  sold_out: styles.sSoldOut,
  archived: styles.sArchived,
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    if (stockFilter) params.set('stock', stockFilter);
    fetch(`${API}/api/admin/products?${params}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setProducts(Array.isArray(data) ? data : (data.products ?? []));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [search, statusFilter, stockFilter]);

  useEffect(() => { load(); }, [load]);

  function thumb(p: Product) {
    const primary = p.images?.find(i => i.isPrimary);
    return primary?.url || p.images?.[0]?.url || p.image || '';
  }

  async function deleteProduct(id: string, name: string) {
    if (!confirm(`Archive "${name}"? It will be hidden from the shop but not deleted.`)) return;
    await fetch(`${API}/api/admin/products/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    setProducts(prev => prev.filter(p => p._id !== id));
  }

  function stockBadge(p: Product) {
    if (!p.totalStock && p.totalStock !== 0) return null;
    if (p.totalStock === 0) return <span className={`${styles.stockBadge} ${styles.skOut}`}>Out of stock</span>;
    if (p.totalStock <= 5) return <span className={`${styles.stockBadge} ${styles.skLow}`}>{p.totalStock} left</span>;
    return <span className={`${styles.stockBadge} ${styles.skIn}`}>{p.totalStock}</span>;
  }

  return (
    <AdminLayout active="products">
      <div className={styles.header}>
        <h2>Products</h2>
        <a href="/admin/products/new" className={styles.addBtn}>+ Add product</a>
      </div>

      <div className={styles.filterBar}>
        <form
          className={styles.searchRow}
          onSubmit={e => { e.preventDefault(); setSearch(searchInput); }}
        >
          <input
            className={styles.searchInput}
            placeholder="Search products…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
          <button type="submit" className={styles.searchBtn}>Search</button>
          {(search || statusFilter || stockFilter) && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => { setSearch(''); setSearchInput(''); setStatusFilter(''); setStockFilter(''); }}
            >
              Clear
            </button>
          )}
        </form>

        <div className={styles.filterSelects}>
          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="sold_out">Sold out</option>
            <option value="archived">Archived</option>
          </select>

          <select
            className={styles.filterSelect}
            value={stockFilter}
            onChange={e => setStockFilter(e.target.value)}
          >
            <option value="">All stock</option>
            <option value="in">In stock</option>
            <option value="low">Low stock (≤ 5)</option>
            <option value="out">Out of stock</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p className={styles.loadingText}>Loading…</p>
      ) : products.length === 0 ? (
        <p className={styles.emptyText}>No products found.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <colgroup>
              <col /><col /><col /><col /><col /><col /><col />
            </colgroup>
            <thead>
              <tr>
                <th>Image</th>
                <th>Name</th>
                <th>Status</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => (
                <tr key={product._id}>
                  <td>
                    {thumb(product) ? (
                      <img src={thumb(product)} alt={product.name} className={styles.thumbnail} />
                    ) : (
                      <div className={styles.noImage}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="M21 15l-5-5L5 21" />
                        </svg>
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={styles.productName}>{product.name}</span>
                    {product.category && <span className={styles.productCategory}>{product.category}</span>}
                  </td>
                  <td>
                    <span className={`${styles.statusBadge} ${STATUS_CLASS[product.status] ?? ''}`}>
                      {STATUS_LABEL[product.status] ?? product.status}
                    </span>
                  </td>
                  <td>€{product.price?.toFixed(2)}</td>
                  <td>{stockBadge(product)}</td>
                  <td className={styles.updatedAt}>
                    {product.updatedAt
                      ? new Date(product.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
                      : '—'}
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <a href={`/admin/products/${product._id}`} className={styles.editBtn}>Edit</a>
                      <button
                        className={styles.deleteBtn}
                        onClick={() => deleteProduct(product._id, product.name)}
                      >
                        Archive
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
