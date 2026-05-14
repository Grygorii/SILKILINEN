'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

export default function NewProductPage() {
  const router = useRouter();

  useEffect(() => {
    async function createAndRedirect() {
      try {
        const res = await fetch(`${API}/api/admin/products`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ createEmptyDraft: true }),
        });
        if (!res.ok) throw new Error('Failed to create product');
        const product = await res.json();
        router.replace(`/admin/products/${product._id}`);
      } catch {
        router.replace('/admin/products');
      }
    }
    createAndRedirect();
  }, []); // eslint-disable-line

  return (
    <AdminLayout active="products">
      <div className={styles.creating}>
        <p className={styles.creatingText}>Creating new product…</p>
      </div>
    </AdminLayout>
  );
}
