'use client';

import { useEffect } from 'react';
import { useCart } from '@/context/CartContext';
import styles from './page.module.css';

export default function SuccessPage() {
  const { clearCart } = useCart();

  useEffect(() => {
    clearCart();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.icon}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <h1>Order confirmed</h1>
        <p>Thank you for your purchase. You will receive a confirmation email shortly.</p>
        <a href="/shop" className={styles.btn}>Continue shopping</a>
      </div>
    </main>
  );
}
