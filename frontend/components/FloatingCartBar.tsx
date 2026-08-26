'use client';

import { usePathname } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import Price from './Price';
import styles from './FloatingCartBar.module.css';

export default function FloatingCartBar() {
  const pathname = usePathname();
  const { cart } = useCart();
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (count === 0) return null;

  // Not on a product page. StickyBuyBar already owns the bottom edge there,
  // and two fixed cart controls stacked on one screen is exactly what §54
  // means by "one floating utility only" — the chat bubble makes three. The
  // cart is still one tap away from the bag icon in the header.
  // Locale-tolerant: /de/product/... is still a product page.
  if (/^\/(?:[a-z]{2}\/)?product\//.test(pathname || '')) return null;

  function openCart() {
    window.dispatchEvent(new Event('openCart'));
  }

  return (
    <button className={styles.bar} onClick={openCart} aria-label="View cart">
      <span className={styles.label}>View cart ({count})</span>
      <span className={styles.price}><Price eur={total} /> →</span>
    </button>
  );
}
