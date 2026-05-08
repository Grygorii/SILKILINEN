'use client';

import { useEffect, useState } from 'react';
import styles from './AddedToCartToast.module.css';

type Toast = { id: number; message: string; isCapped?: boolean };

export default function AddedToCartToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = { current: 0 };

  useEffect(() => {
    function addHandler(e: Event) {
      const id = ++nextId.current;
      setToasts(prev => [...prev, { id, message: (e as CustomEvent<string>).detail || 'item' }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2500);
    }
    function cappedHandler(e: Event) {
      const id = ++nextId.current;
      setToasts(prev => [...prev, { id, message: (e as CustomEvent<string>).detail || 'Quantity limit reached.', isCapped: true }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
    }
    window.addEventListener('cartItemAdded', addHandler);
    window.addEventListener('cartCapped', cappedHandler);
    return () => {
      window.removeEventListener('cartItemAdded', addHandler);
      window.removeEventListener('cartCapped', cappedHandler);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className={styles.stack}>
      {toasts.map(t => (
        <div key={t.id} className={styles.toast}>
          <span className={styles.check}>{t.isCapped ? '!' : '✓'}</span>
          <span className={styles.msg}>{t.isCapped ? t.message : 'Added to cart'}</span>
          {!t.isCapped && (
            <button
              className={styles.viewBtn}
              onClick={() => window.dispatchEvent(new Event('openCart'))}
            >
              View cart
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
