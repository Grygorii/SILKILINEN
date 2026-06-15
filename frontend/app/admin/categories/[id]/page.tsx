'use client';

import { useState, useEffect, useCallback, use } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { toast } from '@/lib/adminToast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type CategoryStatus = 'active' | 'archived';

type Form = {
  slug: string;
  label: string;
  description: string;
  metaTitle: string;
  metaDescription: string;
  status: CategoryStatus;
  displayOrder: string;
  heroImageUrl: string;
  heroImageAlt: string;
};

const EMPTY_FORM: Form = {
  slug: '', label: '', description: '',
  metaTitle: '', metaDescription: '',
  status: 'active', displayOrder: '0',
  heroImageUrl: '', heroImageAlt: '',
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function AdminCategoryEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isNew = id === 'new';
  const router = useRouter();

  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [productCount, setProductCount] = useState(0);
  const [products, setProducts] = useState<{ _id: string; name: string; category?: string }[]>([]);
  const [allCategories, setAllCategories] = useState<{ slug: string; label: string }[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [generatingSeo, setGeneratingSeo] = useState(false);

  const load = useCallback(async () => {
    if (isNew) return;
    try {
      const res = await fetch(`${API}/api/admin/categories/${id}`, { credentials: 'include' });
      if (!res.ok) { setLoadError('Category not found'); return; }
      const data = await res.json();
      setForm({
        slug: data.slug || '',
        label: data.label || '',
        description: data.description || '',
        metaTitle: data.metaTitle || '',
        metaDescription: data.metaDescription || '',
        status: data.status || 'active',
        displayOrder: data.displayOrder != null ? String(data.displayOrder) : '0',
        heroImageUrl: data.heroImage?.url || '',
        heroImageAlt: data.heroImage?.alt || '',
      });
      setProductCount(data.productCount || 0);
    } catch {
      setLoadError('Failed to load category');
    }
  }, [id, isNew]);

  useEffect(() => { load(); }, [load]);

  // Load the products tagged with this category (all statuses) plus the full
  // category list, so each product can be reassigned inline.
  const loadProducts = useCallback(async () => {
    if (isNew || !form.slug) return;
    setLoadingProducts(true);
    try {
      const [pRes, cRes] = await Promise.all([
        fetch(`${API}/api/admin/products?category=${encodeURIComponent(form.slug)}&status=all`, { credentials: 'include' }),
        fetch(`${API}/api/admin/categories`, { credentials: 'include' }),
      ]);
      if (pRes.ok) {
        const pdata = await pRes.json();
        setProducts(Array.isArray(pdata) ? pdata : (pdata.products || []));
      }
      if (cRes.ok) {
        const cdata = await cRes.json();
        setAllCategories((Array.isArray(cdata) ? cdata : []).map((c: { slug: string; label: string }) => ({ slug: c.slug, label: c.label })));
      }
    } finally {
      setLoadingProducts(false);
    }
  }, [isNew, form.slug]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  async function reassign(productId: string, newSlug: string) {
    if (newSlug === form.slug) return;
    const res = await fetch(`${API}/api/admin/products/${productId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': '1' },
      body: JSON.stringify({ category: newSlug }),
    });
    if (!res.ok) { toast('Failed to reassign product.', 'error'); return; }
    // Product moved out of this category — drop it from the list.
    setProducts(ps => ps.filter(p => p._id !== productId));
    setProductCount(c => Math.max(0, c - 1));
  }

  function set(field: keyof Form, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    setSaved(false);
  }

  // Approve-first: the AI fills the meta fields; nothing is saved until the
  // founder presses Save. Mirrors the product SEO button.
  async function generateSeo() {
    if (isNew) { toast('Save the category first, then generate its SEO.', 'error'); return; }
    setGeneratingSeo(true);
    try {
      const res = await fetch(`${API}/api/admin/categories/${id}/generate-seo`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: form.label, description: form.description }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Generation failed');
      }
      const { seo } = await res.json();
      setForm(f => ({ ...f, metaTitle: seo.metaTitle || f.metaTitle, metaDescription: seo.metaDescription || f.metaDescription }));
      setSaved(false);
      toast('SEO generated — review, then Save to apply.', 'success');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Could not generate SEO.', 'error');
    } finally {
      setGeneratingSeo(false);
    }
  }

  function handleLabelChange(label: string) {
    setForm(f => ({
      ...f,
      label,
      slug: isNew ? slugify(label) : f.slug,
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

      const body = {
        label: form.label,
        description: form.description,
        metaTitle: form.metaTitle,
        metaDescription: form.metaDescription,
        status: form.status,
        displayOrder: form.displayOrder !== '' ? Number(form.displayOrder) : 0,
        heroImage,
      } as Record<string, unknown>;

      if (isNew) {
        body.slug = form.slug;
        const res = await fetch(`${API}/api/admin/categories`, {
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
        router.replace(`/admin/categories/${created._id}`);
        return;
      }

      const res = await fetch(`${API}/api/admin/categories/${id}`, {
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

  if (loadError) {
    return (
      <AdminLayout>
        <p className={styles.errorMsg}>{loadError}</p>
        <Link href="/admin/categories" className={styles.backLink}>← Back to categories</Link>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className={styles.header}>
        <Link href="/admin/categories" className={styles.backLink}>← Categories</Link>
        <h2>{isNew ? 'New Category' : form.label || 'Edit Category'}</h2>
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
            <label className={styles.label}>Label</label>
            <input
              className={styles.input}
              value={form.label}
              onChange={(e) => handleLabelChange(e.target.value)}
              placeholder="e.g. Robes"
            />

            <label className={styles.label}>Slug</label>
            <input
              className={styles.input}
              value={form.slug}
              onChange={(e) => isNew && set('slug', e.target.value)}
              placeholder="e.g. robes"
              disabled={!isNew}
            />
            <p className={styles.hint}>
              {isNew
                ? <>Used in URLs: /shop?category={form.slug || 'slug'}. Locked once saved.</>
                : <>Slug is locked. To rename, archive this category and create a new one.</>
              }
            </p>

            <label className={styles.label}>Description</label>
            <textarea
              className={styles.textarea}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              placeholder="Optional. Surfaced on the storefront where supported."
            />
          </section>

          <section className={styles.section}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <h3 className={styles.sectionTitle} style={{ margin: 0 }}>Search engine (SEO)</h3>
              <button
                type="button"
                className={styles.select}
                onClick={generateSeo}
                disabled={generatingSeo || isNew}
                style={{ cursor: generatingSeo || isNew ? 'default' : 'pointer', width: 'auto', whiteSpace: 'nowrap' }}
              >
                {generatingSeo ? 'Generating…' : '✦ Generate SEO'}
              </button>
            </div>
            <p className={styles.hint}>
              {isNew
                ? 'Save the category first, then generate its meta title and description.'
                : 'AI writes a meta title + description for this category’s /shop view, in the brand voice. Review, then Save to apply.'}
            </p>

            <label className={styles.label}>Meta title</label>
            <input
              className={styles.input}
              value={form.metaTitle}
              onChange={(e) => set('metaTitle', e.target.value)}
              maxLength={70}
              placeholder="e.g. Silk Pillowcases in Mulberry Silk — SILKILINEN"
            />
            <p className={styles.hint}>{form.metaTitle.length}/70 — falls back to the label if empty.</p>

            <label className={styles.label}>Meta description</label>
            <textarea
              className={styles.textarea}
              value={form.metaDescription}
              onChange={(e) => set('metaDescription', e.target.value)}
              rows={3}
              maxLength={165}
              placeholder="One or two calm sentences describing this category for search results."
            />
            <p className={styles.hint}>{form.metaDescription.length}/165 — falls back to the description if empty.</p>
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
            <p className={styles.hint}>Paste a Cloudinary URL. (File upload coming later — for now, upload to Cloudinary directly and paste the URL here.)</p>

            <label className={styles.label}>Alt text</label>
            <input
              className={styles.input}
              value={form.heroImageAlt}
              onChange={(e) => set('heroImageAlt', e.target.value)}
              placeholder="Describes the image for accessibility / SEO"
            />

            {form.heroImageUrl && (
              <div className={styles.heroPreview}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.heroImageUrl} alt={form.heroImageAlt || form.label} />
              </div>
            )}
          </section>

          {!isNew && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Products ({productCount})</h3>
              {loadingProducts ? (
                <p className={styles.hint}>Loading products…</p>
              ) : products.length === 0 ? (
                <p className={styles.hint}>No products are tagged with this category.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {products.map(p => (
                    <div key={p._id} style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between', borderBottom: '1px solid var(--border, #eee)', paddingBottom: 8 }}>
                      <a href={`/admin/products/${p._id}`} style={{ flex: 1, color: 'var(--dark, #1a1916)', textDecoration: 'none', fontSize: 14 }}>{p.name}</a>
                      <select
                        className={styles.select}
                        value={p.category || form.slug}
                        onChange={(e) => reassign(p._id, e.target.value)}
                        style={{ maxWidth: 180 }}
                        aria-label={`Category for ${p.name}`}
                      >
                        {allCategories.map(c => (
                          <option key={c.slug} value={c.slug}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
              <p className={styles.hint} style={{ marginTop: 10 }}>
                Change a product&apos;s category from the dropdown, or click its name to edit it fully.
              </p>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <section className={styles.section}>
            <label className={styles.label}>Status</label>
            <select className={styles.select} value={form.status} onChange={(e) => set('status', e.target.value as CategoryStatus)}>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
            <p className={styles.hint}>Archived categories disappear from public filters but products keep their tag.</p>

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
