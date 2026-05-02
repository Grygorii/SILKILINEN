'use client';

import { useCart } from '@/context/CartContext';
import styles from './FloatingCartBar.module.css';

export default function FloatingCartBar() {
  const { cart } = useCart();
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (count === 0) return null;

  function openCart() {
    window.dispatchEvent(new Event('openCart'));
  }

  return (
    <button className={styles.bar} onClick={openCart} aria-label="View cart">
      <span className={styles.label}>View cart ({count})</span>
      <span className={styles.price}>€{total.toFixed(2)} →</span>
    </button>
  );
}
