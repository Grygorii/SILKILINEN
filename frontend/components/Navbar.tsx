'use client';

import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import CartPanel from './CartPanel';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { cartCount } = useCart();
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <>
      <nav className={styles.nav}>
        <div className={styles.hamburger}>
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div className={styles.logo}>
          <h1>SILKILINEN</h1>
          <p>Silk & Linen</p>
        </div>
        <div className={styles.cart} onClick={() => setCartOpen(true)}>
          <p>Cart ({cartCount})</p>
        </div>
      </nav>
      <CartPanel isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}