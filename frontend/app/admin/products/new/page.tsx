'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

const API = 'https://silkilinen-production.up.railway.app';

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
  });

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`${API}/api/products/upload`, {
      method: 'POST',
      body: formData,
    });
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
        body: JSON.stringify({
          ...form,
          price: Number(form.price),
          colours: form.colours.split(',').map(c => c.trim()),
          sizes: form.sizes.split(',').map(s => s.trim()),
          image: imageUrl,
        }),
      });
      router.push('/admin/products');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>
          <h1>SILKILINEN</h1>
          <p>Admin Panel</p>
        </div>
        <nav className={styles.sidebarNav}>
          <a href="/admin" className={styles.navItem}>📊 Dashboard</a>
          <a href="/admin/products" className={`${styles.navItem} ${styles.active}`}>👗 Products</a>
          <a href="/admin/orders" className={styles.navItem}>📦 Orders</a>
          <a href="/admin/settings" className={styles.navItem}>⚙️ Settings</a>
        </nav>
        <a href="/admin/login" className={styles.logout}>Sign out</a>
      </aside>
      <main className={styles.main}>
        <div className={styles.header}>
          <h2>Add new product</h2>
          <a href="/admin/products" className={styles.backBtn}>← Back</a>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label>Product name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
                required
              />
            </div>
            <div className={styles.field}>
              <label>Price (€)</label>
              <input
                type="number"
                value={form.price}
                onChange={e => setForm({...form, price: e.target.value})}
                required
              />
            </div>
            <div className={styles.field}>
              <label>Category</label>
              <select
                value={form.category}
                onChange={e => setForm({...form, category: e.target.value})}
              >
                <option value="shorts">Shorts</option>
                <option value="dresses">Dresses</option>
                <option value="robes">Robes</option>
                <option value="shirts">Shirts</option>
                <option value="scarves">Scarves</option>
              </select>
            </div>
            <div className={styles.field}>
              <label>Colours (comma separated)</label>
              <input
                type="text"
                placeholder="Sky Blue, Wine Red, Champagne Beige"
                value={form.colours}
                onChange={e => setForm({...form, colours: e.target.value})}
              />
            </div>
            <div className={styles.field}>
              <label>Sizes (comma separated)</label>
              <input
                type="text"
                placeholder="XS, S, M, L, XL"
                value={form.sizes}
                onChange={e => setForm({...form, sizes: e.target.value})}
              />
            </div>
            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label>Description</label>
              <textarea
                rows={4}
                value={form.description}
                onChange={e => setForm({...form, description: e.target.value})}
              />
            </div>
            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label>Product image</label>
              <input type="file" accept="image/*" onChange={handleImageUpload} />
              {imageUrl && <img src={imageUrl} alt="Preview" className={styles.preview} />}
            </div>
          </div>
          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Saving...' : 'Save product'}
          </button>
        </form>
      </main>
    </div>
  );
}