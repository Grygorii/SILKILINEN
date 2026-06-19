'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

export default function NewProductPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    async function createAndRedirect() {
      try {
        const res = await fetch(`${API}/api/admin/products`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ createEmptyDraft: true }),
        });
        if (!res.ok) {
          // Surface the real reason instead of silently bouncing — a silent
          // redirect on failure once hid a broken draft-create entirely.
          let detail = `Server returned ${res.status}`;
          try { const b = await res.json(); detail = b.error || b.message || detail; } catch { /* keep status */ }
          throw new Error(detail);
        }
        const product = await res.json();
        router.replace(`/admin/products/${product._id}`);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Could not create a new product.');
      }
    }
    createAndRedirect();
  }, []); // eslint-disable-line

  return (
    <AdminLayout active="products">
      <div className={styles.creating}>
        {error ? (
          <>
            <p className={styles.creatingText} style={{ color: '#c0392b' }}>Couldn’t create a new product: {error}</p>
            <p className={styles.creatingText}>
              <button onClick={() => location.reload()} style={{ marginRight: 12, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', font: 'inherit' }}>Try again</button>
              <a href="/admin/products" style={{ textDecoration: 'underline' }}>Back to products</a>
            </p>
          </>
        ) : (
          <p className={styles.creatingText}>Creating new product…</p>
        )}
      </div>
    </AdminLayout>
  );
}
