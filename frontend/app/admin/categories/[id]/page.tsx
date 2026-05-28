'use client';

import { useState, useEffect, useCallback, use } from 'react';
import AdminLayout from '@/components/AdminLayout';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type CategoryStatus = 'active' | 'archived';

type Form = {
  slug: string;
  label: string;
  description: string;
  status: CategoryStatus;
  displayOrder: string;
  heroImageUrl: string;
  heroImageAlt: string;
};

const EMPTY_FORM: Form = {
  slug: '', label: '', description: '',
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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');

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

  function set(field: keyof Form, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    setSaved(false);
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
              <h3 className={styles.sectionTitle}>Products</h3>
              <p className={styles.hint}>
                {productCount} product{productCount === 1 ? '' : 's'} currently tagged with this category.
                Assign products to a category from the product edit page.
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
