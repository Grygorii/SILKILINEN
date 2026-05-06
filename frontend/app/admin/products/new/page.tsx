'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Category = { slug: string; label: string };

export default function NewProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);

  const [form, setForm] = useState({
    name: '',
    price: '',
    category: '',
    description: '',
    tags: '',
  });

  useEffect(() => {
    fetch(`${API}/api/categories`)
      .then(r => r.ok ? r.json() : [])
      .then((data: Category[]) => {
        setCategories(data);
        if (data.length > 0) setForm(f => ({ ...f, category: data[0].slug }));
      })
      .catch(() => {});
  }, []);

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) { setError('Product name is required'); return; }
    const price = parseFloat(form.price);
    if (!form.price || isNaN(price) || price <= 0) { setError('Price must be greater than 0'); return; }
    if (!form.category) { setError('Category is required'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: form.name.trim(),
          price,
          category: form.category,
          description: form.description.trim(),
          tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
          status: 'draft',
          variants: [],
          images: [],
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to create product');
        setLoading(false);
        return;
      }

      const created = await res.json();
      router.push(`/admin/products/${created._id}`);
    } catch {
      setError('Network error — please try again');
      setLoading(false);
    }
  }

  return (
    <AdminLayout active="products">
      <div className={styles.header}>
        <h2>New product</h2>
        <a href="/admin/products" className={styles.backBtn}>← Back</a>
      </div>
      <p className={styles.hint}>Start a draft — add images, variants, and full details on the next page.</p>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label>Product name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g., Bastet Silk Robe"
              required
            />
          </div>
          <div className={styles.field}>
            <label>Price (€) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={form.price}
              onChange={e => set('price', e.target.value)}
              placeholder="0.00"
              required
            />
          </div>
          <div className={styles.field}>
            <label>Category *</label>
            <select value={form.category} onChange={e => set('category', e.target.value)}>
              {categories.map(cat => (
                <option key={cat.slug} value={cat.slug}>{cat.label}</option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label>Tags <span className={styles.optional}>(comma separated)</span></label>
            <input
              type="text"
              value={form.tags}
              onChange={e => set('tags', e.target.value)}
              placeholder="silk, handmade, luxury"
            />
          </div>
          <div className={`${styles.field} ${styles.fullWidth}`}>
            <label>Description <span className={styles.optional}>(optional — add fully on next page)</span></label>
            <textarea
              rows={3}
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Brief product description…"
            />
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <a href="/admin/products" className={styles.cancelBtn}>Cancel</a>
          <button type="submit" className={styles.submitBtn} disabled={loading || categories.length === 0}>
            {loading ? 'Creating…' : 'Create draft & continue →'}
          </button>
        </div>
      </form>
    </AdminLayout>
  );
}
