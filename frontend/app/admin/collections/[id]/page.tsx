'use client';

import { useState, useEffect, useCallback, use } from 'react';
import AdminLayout from '@/components/AdminLayout';
import UploadHint from '@/components/UploadHint';
import { UPLOAD_SPECS } from '@/lib/uploadSpecs';
import { toast } from '@/lib/adminToast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type CollectionStatus = 'active' | 'draft' | 'archived';

type Form = {
  name: string;
  slug: string;
  description: string;
  discountPercent: string;
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
  name: '', slug: '', description: '', discountPercent: '0',
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
  const [generatingSeo, setGeneratingSeo] = useState(false);
  const [heroImage, setHeroImage] = useState<{ url?: string } | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

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
        discountPercent: data.discountPercent != null ? String(data.discountPercent) : '0',
        status: data.status || 'active',
        isFeatured: data.isFeatured || false,
        featuredOrder: data.featuredOrder != null ? String(data.featuredOrder) : '',
        displayOrder: data.displayOrder != null ? String(data.displayOrder) : '0',
        metaTitle: data.metaTitle || '',
        metaDescription: data.metaDescription || '',
      });
      setProducts(data.products || []);
      setHeroImage(data.heroImage?.url ? { url: data.heroImage.url } : null);
    } catch {
      setLoadError('Failed to load collection');
    }
  }, [id, isNew]);

  useEffect(() => { load(); }, [load]);

  function set(field: keyof Form, value: string | boolean) {
    setForm(f => ({ ...f, [field]: value }));
    setSaved(false);
  }

  // Approve-first: the AI fills the meta fields; nothing saves until the founder
  // presses Save. Mirrors the product and category SEO buttons.
  async function generateSeo() {
    if (isNew) { toast('Save the collection first, then generate its SEO.', 'error'); return; }
    setGeneratingSeo(true);
    try {
      const res = await fetch(`${API}/api/admin/collections/${id}/generate-seo`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, description: form.description }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Generation failed');
      }
      const { seo } = await res.json();
      setForm(f => ({
        ...f,
        metaTitle: seo.metaTitle || f.metaTitle,
        metaDescription: seo.metaDescription || f.metaDescription,
        // Also fill the on-page description (the founder asked for it). Generated
        // value wins since they pressed the button.
        description: seo.description || f.description,
      }));
      setSaved(false);
      toast('SEO + description generated — review, then Save to apply.', 'success');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Could not generate SEO.', 'error');
    } finally {
      setGeneratingSeo(false);
    }
  }

  function handleNameChange(name: string) {
    // Keep the slug in step with the name (the founder asked for auto-update).
    setForm(f => ({ ...f, name, slug: slugify(name) }));
    setSaved(false);
  }

  async function uploadPhoto(file: File) {
    if (isNew) { toast('Save the collection first, then add a photo.', 'error'); return; }
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch(`${API}/api/admin/collections/${id}/image`, { method: 'POST', credentials: 'include', body: fd });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Upload failed'); }
      const data = await res.json();
      setHeroImage(data.heroImage?.url ? { url: data.heroImage.url } : null);
      toast('Photo uploaded.', 'success');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Upload failed', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const body = {
        name: form.name,
        slug: form.slug,
        description: form.description,
        discountPercent: form.discountPercent !== '' ? Number(form.discountPercent) : 0,
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

            <label className={styles.label}>Collection photo</label>
            <UploadHint spec={UPLOAD_SPECS.collectionHero} title="Collection banner — recommended" />
            {heroImage?.url && (
              <img src={heroImage.url} alt="" style={{ width: '100%', maxWidth: 340, borderRadius: 4, display: 'block', marginBottom: 10, border: '1px solid var(--border, #e8e2d6)' }} />
            )}
            <input
              type="file"
              accept="image/*"
              disabled={isNew || uploadingPhoto}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ''; }}
            />
            <p className={styles.hint}>
              {isNew ? 'Save the collection first, then add a photo.' : uploadingPhoto ? 'Uploading…' : 'Shown as the collection banner. Replaces the current photo.'}
            </p>
          </section>

          <section className={styles.section}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <h3 className={styles.sectionTitle} style={{ margin: 0 }}>SEO</h3>
              <button
                type="button"
                className={styles.input}
                onClick={generateSeo}
                disabled={generatingSeo || isNew}
                style={{ cursor: generatingSeo || isNew ? 'default' : 'pointer', width: 'auto', whiteSpace: 'nowrap' }}
                title={isNew ? 'Save the collection first' : 'Generate a meta title + description in the brand voice'}
              >
                {generatingSeo ? 'Generating…' : '✦ Generate SEO'}
              </button>
            </div>
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

            <label className={styles.label} style={{ marginTop: 16 }}>Collection discount (%)</label>
            <input
              className={styles.input}
              type="number"
              min="0"
              max="90"
              value={form.discountPercent}
              onChange={(e) => set('discountPercent', e.target.value)}
              placeholder="0"
            />
            <p className={styles.hint}>Every product in this collection sells at this % off while it&rsquo;s Active. 0 = no discount.</p>
          </section>
        </aside>
      </div>
    </AdminLayout>
  );
}
