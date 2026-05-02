'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useCustomer } from '@/context/CustomerContext';
import CartPanel from './CartPanel';
import SideMenu from './SideMenu';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { cartCount } = useCart();
  const { count: wishlistCount } = useWishlist();
  const { customer, signOut } = useCustomer();
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () => setCartOpen(true);
    window.addEventListener('openCart', handler);
    return () => window.removeEventListener('openCart', handler);
  }, []);

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  return (
    <>
      <nav className={styles.nav}>
        <div className={styles.hamburger} onClick={() => setMenuOpen(true)}>
          <span></span><span></span><span></span>
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

          {customer ? (
            <div className={styles.accountWrap} ref={dropdownRef}>
              <button
                className={styles.accountBtn}
                onClick={() => setAccountOpen(o => !o)}
                aria-label="Account menu"
              >
                <span className={styles.accountAvatar}>
                  {(customer.firstName?.[0] || customer.email[0]).toUpperCase()}
                </span>
                <span className={styles.accountName}>
                  {customer.firstName || 'Account'}
                </span>
              </button>
              {accountOpen && (
                <div className={styles.accountDropdown}>
                  <a href="/account" className={styles.dropItem}>My account</a>
                  <a href="/account/orders" className={styles.dropItem}>Orders</a>
                  <a href="/account/wishlist" className={styles.dropItem}>Wishlist</a>
                  <a href="/account/profile" className={styles.dropItem}>Profile</a>
                  <div className={styles.dropDivider} />
                  <button
                    className={styles.dropSignOut}
                    onClick={() => { signOut(); setAccountOpen(false); window.location.href = '/'; }}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <a href="/account/sign-in" className={styles.signInLink}>Sign in</a>
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
