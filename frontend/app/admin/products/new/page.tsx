'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function CharCounter({ value, max }: { value: string; max: number }) {
  const len = value.length;
  const cls = len === 0 ? styles.counterOk : len > max ? styles.counterOver : len > max * 0.85 ? styles.counterWarn : styles.counterOk;
  return <span className={`${styles.charCounter} ${cls}`}>{len} / {max}</span>;
}

export default function NewProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [form, setForm] = useState({
    name: '',
    price: '',
    category: 'shorts',
    description: '',
    colours: '',
    sizes: '',
    stockLevel: '',
    metaTitle: '',
    metaDescription: '',
    altText: '',
  });

  function set(field: string, value: string) {
    setForm(f => {
      const next = { ...f, [field]: value };
      if (field === 'name' && !f.metaTitle) next.metaTitle = value + ' — SILKILINEN';
      if (field === 'description' && !f.metaDescription) next.metaDescription = value.slice(0, 155);
      return next;
    });
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch(`${API}/api/products/upload`, { method: 'POST', body: fd });
    const data = await res.json();
    setImageUrl(data.url);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch(`${API}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...form,
          price: Number(form.price),
          stockLevel: form.stockLevel !== '' ? Number(form.stockLevel) : null,
          colours: form.colours.split(',').map(c => c.trim()).filter(Boolean),
          sizes: form.sizes.split(',').map(s => s.trim()).filter(Boolean),
          slug: slugify(form.name),
          image: imageUrl,
        }),
      });
      router.push('/admin/products');
    } finally {
      setLoading(false);
    }
  }

  const previewTitle = form.metaTitle || (form.name ? `${form.name} — SILKILINEN` : 'Product title');
  const previewDesc = form.metaDescription || form.description.slice(0, 155) || 'Product description will appear here.';

  return (
    <AdminLayout active="products">
      <div className={styles.header}>
        <h2>Add new product</h2>
        <a href="/admin/products" className={styles.backBtn}>← Back</a>
      </div>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label>Product name</label>
            <input type="text" value={form.name} onChange={e => set('name', e.target.value)} required />
          </div>
          <div className={styles.field}>
            <label>Price (€)</label>
            <input type="number" step="0.01" value={form.price} onChange={e => set('price', e.target.value)} required />
          </div>
          <div className={styles.field}>
            <label>Category</label>
            <select value={form.category} onChange={e => set('category', e.target.value)}>
              <option value="shorts">Shorts</option>
              <option value="dresses">Dresses</option>
              <option value="robes">Robes</option>
              <option value="shirts">Shirts</option>
              <option value="scarves">Scarves</option>
            </select>
          </div>
          <div className={styles.field}>
            <label>Stock level</label>
            <input type="number" min="0" placeholder="Leave blank if not tracked" value={form.stockLevel} onChange={e => set('stockLevel', e.target.value)} />
          </div>
          <div className={styles.field}>
            <label>Colours (comma separated)</label>
            <input type="text" placeholder="Ivory, Blush, Navy" value={form.colours} onChange={e => set('colours', e.target.value)} />
          </div>
          <div className={styles.field}>
            <label>Sizes (comma separated)</label>
            <input type="text" placeholder="XS, S, M, L, XL" value={form.sizes} onChange={e => set('sizes', e.target.value)} />
          </div>
          <div className={`${styles.field} ${styles.fullWidth}`}>
            <label>Description</label>
            <textarea rows={4} value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <div className={`${styles.field} ${styles.fullWidth}`}>
            <label>Product image</label>
            <input type="file" accept="image/*" onChange={handleImageUpload} />
            {imageUrl && <img src={imageUrl} alt="Preview" className={styles.preview} />}
          </div>
        </div>

        {/* SEO Section */}
        <div className={styles.seoSection}>
          <h3>SEO</h3>
          <div className={styles.formGrid}>
            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label>Meta title <CharCounter value={form.metaTitle} max={60} /></label>
              <input type="text" placeholder={`${form.name || 'Product name'} — SILKILINEN`} value={form.metaTitle} onChange={e => set('metaTitle', e.target.value)} />
              <span className={styles.fieldHint}>Shown as the page title in Google. Defaults to product name + brand.</span>
            </div>
            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label>Meta description <CharCounter value={form.metaDescription} max={155} /></label>
              <textarea rows={3} placeholder="Brief description shown in search results…" value={form.metaDescription} onChange={e => set('metaDescription', e.target.value)} />
              <span className={styles.fieldHint}>Aim for 120–155 characters.</span>
            </div>
            <div className={styles.field}>
              <label>Image alt text</label>
              <input type="text" placeholder="Describe the product image for screen readers and SEO" value={form.altText} onChange={e => set('altText', e.target.value)} />
            </div>
            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label>Google preview</label>
              <div className={styles.googlePreview}>
                <p className={styles.gpUrl}>silkilinen.vercel.app › product</p>
                <p className={styles.gpTitle}>{previewTitle}</p>
                <p className={styles.gpDesc}>{previewDesc}</p>
              </div>
            </div>
          </div>
        </div>

        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? 'Saving…' : 'Save product'}
        </button>
      </form>
    </AdminLayout>
  );
}
