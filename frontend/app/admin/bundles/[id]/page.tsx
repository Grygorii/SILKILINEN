'use client';

import { useState, useEffect, useCallback, use } from 'react';
import AdminLayout from '@/components/AdminLayout';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type BundleStatus = 'active' | 'draft' | 'archived';

type Form = {
  name: string;
  slug: string;
  description: string;
  status: BundleStatus;
  discountPercent: string;
  isFeatured: boolean;
  featuredOrder: string;
  displayOrder: string;
  heroImageUrl: string;
  heroImageAlt: string;
  metaTitle: string;
  metaDescription: string;
};

type Product = {
  _id: string;
  name: string;
  status: string;
  price: number;
  slug?: string;
  images?: { url: string; isPrimary?: boolean }[];
};

type BundleChild = {
  productId: Product;
  displayOrder?: number;
};

const EMPTY_FORM: Form = {
  name: '', slug: '', description: '',
  status: 'draft', discountPercent: '0',
  isFeatured: false, featuredOrder: '', displayOrder: '0',
  heroImageUrl: '', heroImageAlt: '',
  metaTitle: '', metaDescription: '',
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function computePricing(products: Product[], discountPercent: number) {
  const pct = Math.max(0, Math.min(100, discountPercent || 0));
  const originalTotal = products.reduce((s, p) => s + (Number(p.price) || 0), 0);
  const bundlePrice = originalTotal * (1 - pct / 100);
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    originalTotal: round(originalTotal),
    bundlePrice: round(bundlePrice),
    savings: round(originalTotal - bundlePrice),
  };
}

export default function AdminBundleEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isNew = id === 'new';
  const router = useRouter();

  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [children, setChildren] = useState<BundleChild[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');

  // Product assignment
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    if (isNew) return;
    try {
      const res = await fetch(`${API}/api/admin/bundles/${id}`, { credentials: 'include' });
      if (!res.ok) { setLoadError('Bundle not found'); return; }
      const data = await res.json();
      setForm({
        name: data.name || '',
        slug: data.slug || '',
        description: data.description || '',
        status: data.status || 'draft',
        discountPercent: data.discountPercent != null ? String(data.discountPercent) : '0',
        isFeatured: data.isFeatured || false,
        featuredOrder: data.featuredOrder != null ? String(data.featuredOrder) : '',
        displayOrder: data.displayOrder != null ? String(data.displayOrder) : '0',
        heroImageUrl: data.heroImage?.url || '',
        heroImageAlt: data.heroImage?.alt || '',
        metaTitle: data.metaTitle || '',
        metaDescription: data.metaDescription || '',
      });
      setChildren(data.products || []);
    } catch {
      setLoadError('Failed to load bundle');
    }
  }, [id, isNew]);

  useEffect(() => { load(); }, [load]);

  function set<K extends keyof Form>(field: K, value: Form[K]) {
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
      const heroImage = form.heroImageUrl
        ? { url: form.heroImageUrl, alt: form.heroImageAlt }
        : undefined;

      const body: Record<string, unknown> = {
        name: form.name,
        description: form.description,
        status: form.status,
        discountPercent: form.discountPercent !== '' ? Number(form.discountPercent) : 0,
        isFeatured: form.isFeatured,
        featuredOrder: form.featuredOrder !== '' ? Number(form.featuredOrder) : undefined,
        displayOrder: form.displayOrder !== '' ? Number(form.displayOrder) : 0,
        heroImage,
        metaTitle: form.metaTitle,
        metaDescription: form.metaDescription,
      };

      if (isNew) {
        body.slug = form.slug;
        const res = await fetch(`${API}/api/admin/bundles`, {
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
        router.replace(`/admin/bundles/${created._id}`);
        return;
      }

      const res = await fetch(`${API}/api/admin/bundles/${id}`, {
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
        const assignedIds = new Set(children.map(c => c.productId?._id));
        setSearchResults(list.filter(p => !assignedIds.has(p._id)));
      }
    } finally {
      setSearching(false);
    }
  }

  async function assignProduct(productId: string) {
    await fetch(`${API}/api/admin/bundles/${id}/products`, {
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
    await fetch(`${API}/api/admin/bundles/${id}/products/${productId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    load();
  }

  // Live pricing — recomputed every render from current children + form discount
  const products = children.map(c => c.productId).filter(Boolean);
  const pricing = computePricing(products, Number(form.discountPercent) || 0);

  if (loadError) {
    return (
      <AdminLayout>
        <p className={styles.errorMsg}>{loadError}</p>
        <Link href="/admin/bundles" className={styles.backLink}>← Back to bundles</Link>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className={styles.header}>
        <Link href="/admin/bundles" className={styles.backLink}>← Bundles</Link>
        <h2>{isNew ? 'New Bundle' : form.name || 'Edit Bundle'}</h2>
        <div className={styles.headerRight}>
          {saved && <span className={styles.savedBadge}>Saved</span>}
          {error && <span className={styles.errorBadge}>{error}</span>}
          <button className={styles.saveBtn} onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className={styles.layout}>
        {/* Main */}
        <div className={styles.main}>
          <section className={styles.section}>
            <label className={styles.label}>Name</label>
            <input
              className={styles.input}
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Lounge Set"
            />

            <label className={styles.label}>Slug</label>
            <input
              className={styles.input}
              value={form.slug}
              onChange={(e) => isNew && set('slug', e.target.value)}
              placeholder="e.g. lounge-set"
              disabled={!isNew}
            />
            <p className={styles.hint}>
              {isNew
                ? <>URL: /bundles/{form.slug || 'slug'}. Locked once saved.</>
                : <>Slug is locked. To rename, archive and create a new bundle.</>
              }
            </p>

            <label className={styles.label}>Description</label>
            <textarea
              className={styles.textarea}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              placeholder="A short description shown on the bundle page."
            />
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Hero image</h3>
            <label className={styles.label}>Image URL</label>
            <input
              className={styles.input}
              value={form.heroImageUrl}
              onChange={(e) => set('heroImageUrl', e.target.value)}
              placeholder="https://res.cloudinary.com/…"
            />
            <label className={styles.label}>Alt text</label>
            <input
              className={styles.input}
              value={form.heroImageAlt}
              onChange={(e) => set('heroImageAlt', e.target.value)}
              placeholder="Describes the image for accessibility"
            />
            {form.heroImageUrl && (
              <div className={styles.heroPreview}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.heroImageUrl} alt={form.heroImageAlt || form.name} />
              </div>
            )}
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>SEO</h3>
            <label className={styles.label}>Meta title <span className={styles.charCount}>{form.metaTitle.length}/70</span></label>
            <input
              className={styles.input}
              value={form.metaTitle}
              onChange={(e) => set('metaTitle', e.target.value)}
              maxLength={70}
              placeholder="Leave blank to use bundle name"
            />
            <label className={styles.label}>Meta description <span className={styles.charCount}>{form.metaDescription.length}/165</span></label>
            <textarea
              className={styles.textarea}
              value={form.metaDescription}
              onChange={(e) => set('metaDescription', e.target.value)}
              maxLength={165}
              rows={3}
            />
          </section>

          {/* Product assignment */}
          {!isNew && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Included products ({children.length})</h3>
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
                        <span>{p.name} — €{Number(p.price).toFixed(2)}</span>
                        <button className={styles.addProductBtn} onClick={() => assignProduct(p._id)}>Add</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {children.length > 0 ? (
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
                    {children.map((c) => c.productId && (
                      <tr key={c.productId._id}>
                        <td>
                          <Link href={`/admin/products/${c.productId._id}`} className={styles.productLink}>
                            {c.productId.name}
                          </Link>
                        </td>
                        <td>{c.productId.status}</td>
                        <td>€{Number(c.productId.price).toFixed(2)}</td>
                        <td>
                          <button className={styles.removeBtn} onClick={() => removeProduct(c.productId._id)}>Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className={styles.hint}>No products yet. Add at least one product for the bundle to be purchasable.</p>
              )}
            </section>
          )}
        </div>

        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <section className={styles.section}>
            <label className={styles.label}>Status</label>
            <select className={styles.select} value={form.status} onChange={(e) => set('status', e.target.value as BundleStatus)}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>

            <label className={styles.label} style={{ marginTop: 16 }}>Discount %</label>
            <input
              className={styles.input}
              type="number"
              min="0"
              max="100"
              value={form.discountPercent}
              onChange={(e) => set('discountPercent', e.target.value)}
              placeholder="10"
            />
            <p className={styles.hint}>Percent off the sum of included product prices.</p>

            {/* Live pricing preview */}
            <div className={styles.pricingBox}>
              <p className={styles.pricingRow}><span>Original total</span><span>€{pricing.originalTotal.toFixed(2)}</span></p>
              <p className={styles.pricingRow}><span>Bundle price</span><strong>€{pricing.bundlePrice.toFixed(2)}</strong></p>
              <p className={styles.pricingRow}><span>Savings</span><span className={styles.pricingSavings}>−€{pricing.savings.toFixed(2)}</span></p>
            </div>

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
            <p className={styles.hint}>Lower number = appears first.</p>
          </section>
        </aside>
      </div>
    </AdminLayout>
  );
}
