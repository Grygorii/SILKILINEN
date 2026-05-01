'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import CartPanel from './CartPanel';
import SideMenu from './SideMenu';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { cartCount } = useCart();
  const { count: wishlistCount } = useWishlist();
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <nav className={styles.nav}>
        <div className={styles.hamburger} onClick={() => setMenuOpen(true)}>
          <span></span>
          <span></span>
          <span></span>
        </div>
        <Link href="/" className={styles.logoLink}>
          <div className={styles.logo}>
            <h1>SILKILINEN</h1>
            <p>Silk &amp; Linen</p>
          </div>
        </Link>
        <div className={styles.navRight}>
          {wishlistCount > 0 && (
            <Link href="/wishlist" className={styles.wishlistLink} aria-label="Wishlist">
              ♥ {wishlistCount}
            </Link>
          )}
          <div className={styles.cart} onClick={() => setCartOpen(true)}>
            <p>Cart ({cartCount})</p>
          </div>
        </div>
      </nav>
      <SideMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
      <CartPanel isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
