'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Menu, Heart, User, ShoppingBag } from 'lucide-react';
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

  const avatarLetter = customer
    ? (customer.firstName?.[0] || customer.email[0]).toUpperCase()
    : null;

  return (
    <>
      <nav className={styles.nav}>
        {/* Hamburger — left */}
        <button
          className={styles.hamburger}
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={22} strokeWidth={1.5} />
        </button>

        {/* Logo — centre */}
        <Link href="/" className={styles.logoLink}>
          <div className={styles.logo}>
            <h1>SILKILINEN</h1>
            <p className={styles.logoSub}>Silk &amp; Linen</p>
          </div>
        </Link>

        {/* Right actions */}
        <div className={styles.navRight}>

          {/* ── Wishlist ─────────────────────────── */}
          {/* Desktop: text link, only when items > 0 */}
          {wishlistCount > 0 && (
            <Link href="/wishlist" className={`${styles.wishlistLink} ${styles.desktopOnly}`} aria-label="Wishlist">
              ♥ {wishlistCount}
            </Link>
          )}
          {/* Mobile: heart icon, only when count > 0 */}
          {wishlistCount > 0 && (
            <Link href="/wishlist" className={`${styles.iconBtn} ${styles.mobileOnly}`} aria-label={`Wishlist, ${wishlistCount} items`}>
              <Heart size={22} strokeWidth={1.5} />
              <span className={styles.badge}>{wishlistCount}</span>
            </Link>
          )}

          {/* ── Account ──────────────────────────── */}
          {customer ? (
            <div className={styles.accountWrap} ref={dropdownRef}>
              {/* Desktop: avatar circle + name */}
              <button
                className={`${styles.accountBtn} ${styles.desktopOnly}`}
                onClick={() => setAccountOpen(o => !o)}
                aria-label="Account menu"
              >
                <span className={styles.accountAvatar}>{avatarLetter}</span>
                <span className={styles.accountName}>{customer.firstName || 'Account'}</span>
              </button>
              {/* Mobile: avatar circle only (already icon-sized) */}
              <button
                className={`${styles.iconBtn} ${styles.mobileOnly}`}
                onClick={() => setAccountOpen(o => !o)}
                aria-label="Account menu"
              >
                <span className={styles.accountAvatar}>{avatarLetter}</span>
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
                    onClick={async () => { await signOut(); setAccountOpen(false); window.location.href = '/'; }}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Desktop: text link */}
              <a href="/account/sign-in" className={`${styles.signInLink} ${styles.desktopOnly}`}>Sign in</a>
              {/* Mobile: User icon */}
              <a href="/account/sign-in" className={`${styles.iconBtn} ${styles.mobileOnly}`} aria-label="Sign in">
                <User size={22} strokeWidth={1.5} />
              </a>
            </>
          )}

          {/* ── Cart ─────────────────────────────── */}
          {/* Desktop: text */}
          <div className={`${styles.cart} ${styles.desktopOnly}`} onClick={() => setCartOpen(true)}>
            <p>Cart ({cartCount})</p>
          </div>
          {/* Mobile: bag icon + badge */}
          <button
            className={`${styles.iconBtn} ${styles.mobileOnly}`}
            onClick={() => setCartOpen(true)}
            aria-label={`Cart, ${cartCount} item${cartCount !== 1 ? 's' : ''}`}
          >
            <ShoppingBag size={22} strokeWidth={1.5} />
            {cartCount > 0 && <span className={styles.badge}>{cartCount}</span>}
          </button>
        </div>
      </nav>

      <SideMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
      <CartPanel isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
