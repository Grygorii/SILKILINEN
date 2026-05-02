'use client';

import { useEffect, useState } from 'react';
import styles from './AddedToCartToast.module.css';

type Toast = { id: number; name: string };

export default function AddedToCartToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = { current: 0 };

  useEffect(() => {
    function handler(e: Event) {
      const name = (e as CustomEvent<string>).detail || 'item';
      const id = ++nextId.current;
      setToasts(prev => [...prev, { id, name }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2500);
    }
    window.addEventListener('cartItemAdded', handler);
    return () => window.removeEventListener('cartItemAdded', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className={styles.stack}>
      {toasts.map(t => (
        <div key={t.id} className={styles.toast}>
          <span className={styles.check}>✓</span>
          <span className={styles.msg}>Added to cart</span>
          <button
            className={styles.viewBtn}
            onClick={() => window.dispatchEvent(new Event('openCart'))}
          >
            View cart
          </button>
        </div>
      ))}
    </div>
  );
}
