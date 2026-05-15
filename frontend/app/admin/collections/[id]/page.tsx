'use client';

import { useState, useEffect, useCallback, use } from 'react';
import AdminLayout from '@/components/AdminLayout';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type CollectionStatus = 'active' | 'draft' | 'archived';

type Form = {
  name: string;
  slug: string;
  description: string;
  status: CollectionStatus;
  isFeatured: boolean;
  featuredOrder: string;
  displayOrder: string;
  metaTitle: string;
  metaDescription: string;
};

type Product = {
  _id: string;
  name: string;
  status: string;
  price: number;
  images: { url: string; isPrimary?: boolean }[];
};

const EMPTY_FORM: Form = {
  name: '', slug: '', description: '',
  status: 'active', isFeatured: false,
  featuredOrder: '', displayOrder: '0',
  metaTitle: '', metaDescription: '',
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function AdminCollectionEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isNew = id === 'new';
  const router = useRouter();

  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [products, setProducts] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');

  // Product assignment state
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    if (isNew) return;
    try {
      const res = await fetch(`${API}/api/admin/collections/${id}`, { credentials: 'include' });
      if (!res.ok) { setLoadError('Collection not found'); return; }
      const data = await res.json();
      setForm({
        name: data.name || '',
        slug: data.slug || '',
        description: data.description || '',
        status: data.status || 'active',
        isFeatured: data.isFeatured || false,
        featuredOrder: data.featuredOrder != null ? String(data.featuredOrder) : '',
        displayOrder: data.displayOrder != null ? String(data.displayOrder) : '0',
        metaTitle: data.metaTitle || '',
        metaDescription: data.metaDescription || '',
      });
      setProducts(data.products || []);
    } catch {
      setLoadError('Failed to load collection');
    }
  }, [id, isNew]);

  useEffect(() => { load(); }, [load]);

  function set(field: keyof Form, value: string | boolean) {
    setForm(f => ({ ...f, [field]: value }));
    setSaved(false);
  }

  function handleNameChange(name: string) {
    setForm(f => ({
      ...f,
      name,
      slug: isNew ? slugify(name) : f.slug,
    }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const body = {
        name: form.name,
        slug: form.slug,
        description: form.description,
        status: form.status,
        isFeatured: form.isFeatured,
        featuredOrder: form.featuredOrder !== '' ? Number(form.featuredOrder) : undefined,
        displayOrder: form.displayOrder !== '' ? Number(form.displayOrder) : 0,
        metaTitle: form.metaTitle,
        metaDescription: form.metaDescription,
      };

      if (isNew) {
        const res = await fetch(`${API}/api/admin/collections`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Save failed');
        }
        const created = await res.json();
        router.replace(`/admin/collections/${created._id}`);
        return;
      }

      const res = await fetch(`${API}/api/admin/collections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Save failed');
      }
      setSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function searchProducts(q: string) {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`${API}/api/admin/products?search=${encodeURIComponent(q)}&limit=10`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const list: Product[] = Array.isArray(data) ? data : (data.products || []);
        const assignedIds = new Set(products.map((p: Product) => p._id));
        setSearchResults(list.filter((p: Product) => !assignedIds.has(p._id)));
      }
    } finally {
      setSearching(false);
    }
  }

  async function assignProduct(productId: string) {
    await fetch(`${API}/api/admin/collections/${id}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ productId }),
    });
    setProductSearch('');
    setSearchResults([]);
    load();
  }

  async function removeProduct(productId: string) {
    await fetch(`${API}/api/admin/collections/${id}/products/${productId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    load();
  }

  if (loadError) {
    return (
      <AdminLayout>
        <p className={styles.errorMsg}>{loadError}</p>
        <Link href="/admin/collections" className={styles.backLink}>← Back to collections</Link>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className={styles.header}>
        <Link href="/admin/collections" className={styles.backLink}>← Collections</Link>
        <h2>{isNew ? 'New Collection' : form.name || 'Edit Collection'}</h2>
        <div className={styles.headerRight}>
          {saved && <span className={styles.savedBadge}>Saved</span>}
          {error && <span className={styles.errorBadge}>{error}</span>}
          <button className={styles.saveBtn} onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className={styles.layout}>
        {/* Main fields */}
        <div className={styles.main}>
          <section className={styles.section}>
            <label className={styles.label}>Name</label>
            <input
              className={styles.input}
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Sleepwear"
            />

            <label className={styles.label}>Slug</label>
            <input
              className={styles.input}
              value={form.slug}
              onChange={(e) => set('slug', e.target.value)}
              placeholder="e.g. sleepwear"
            />
            <p className={styles.hint}>Used in URLs: /collections/{form.slug || 'slug'}</p>

            <label className={styles.label}>Description</label>
            <textarea
              className={styles.textarea}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={4}
              placeholder="A short description shown on the collection page."
            />
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>SEO</h3>
            <label className={styles.label}>Meta title <span className={styles.charCount}>{form.metaTitle.length}/70</span></label>
            <input
              className={styles.input}
              value={form.metaTitle}
              onChange={(e) => set('metaTitle', e.target.value)}
              maxLength={70}
              placeholder="Leave blank to use collection name"
            />
            <label className={styles.label}>Meta description <span className={styles.charCount}>{form.metaDescription.length}/165</span></label>
            <textarea
              className={styles.textarea}
              value={form.metaDescription}
              onChange={(e) => set('metaDescription', e.target.value)}
              maxLength={165}
              rows={3}
              placeholder="Leave blank to use collection description"
            />
          </section>

          {/* Product assignment — only shown for existing collections */}
          {!isNew && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Products ({products.length})</h3>
              <div className={styles.productSearch}>
                <input
                  className={styles.input}
                  value={productSearch}
                  onChange={(e) => { setProductSearch(e.target.value); searchProducts(e.target.value); }}
                  placeholder="Search products to add…"
                />
                {searching && <p className={styles.hint}>Searching…</p>}
                {searchResults.length > 0 && (
                  <ul className={styles.searchDropdown}>
                    {searchResults.map((p) => (
                      <li key={p._id} className={styles.searchItem}>
                        <span>{p.name}</span>
                        <button className={styles.addProductBtn} onClick={() => assignProduct(p._id)}>Add</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {products.length > 0 && (
                <table className={styles.productTable}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Status</th>
                      <th>Price</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p._id}>
                        <td>
                          <Link href={`/admin/products/${p._id}`} className={styles.productLink}>
                            {p.name}
                          </Link>
                        </td>
                        <td>{p.status}</td>
                        <td>€{Number(p.price).toFixed(2)}</td>
                        <td>
                          <button className={styles.removeBtn} onClick={() => removeProduct(p._id)}>Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}
        </div>

        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <section className={styles.section}>
            <label className={styles.label}>Status</label>
            <select className={styles.select} value={form.status} onChange={(e) => set('status', e.target.value as CollectionStatus)}>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>

            <label className={styles.label} style={{ marginTop: 16 }}>
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(e) => set('isFeatured', e.target.checked)}
                style={{ marginRight: 8 }}
              />
              Featured on homepage
            </label>

            {form.isFeatured && (
              <>
                <label className={styles.label} style={{ marginTop: 12 }}>Featured order</label>
                <input
                  className={styles.input}
                  type="number"
                  min="0"
                  value={form.featuredOrder}
                  onChange={(e) => set('featuredOrder', e.target.value)}
                  placeholder="1"
                />
              </>
            )}

            <label className={styles.label} style={{ marginTop: 16 }}>Display order</label>
            <input
              className={styles.input}
              type="number"
              min="0"
              value={form.displayOrder}
              onChange={(e) => set('displayOrder', e.target.value)}
              placeholder="0"
            />
            <p className={styles.hint}>Lower number = appears first in lists.</p>
          </section>
        </aside>
      </div>
    </AdminLayout>
  );
}
