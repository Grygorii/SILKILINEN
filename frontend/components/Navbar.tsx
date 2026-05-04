'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Search, User, ShoppingBag, Menu, X } from 'lucide-react';
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 20); }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  function handleSearch(e: { preventDefault(): void }) {
    e.preventDefault();
    const q = searchRef.current?.value.trim();
    if (q) {
      window.location.href = `/shop?q=${encodeURIComponent(q)}`;
      setSearchOpen(false);
    }
  }

  const avatarLetter = customer
    ? (customer.firstName?.[0] || customer.email[0]).toUpperCase()
    : null;

  return (
    <>
      <nav className={`${styles.nav} ${scrolled ? styles.scrolled : ''}`}>
        {searchOpen ? (
          <div className={styles.searchBar}>
            <form onSubmit={handleSearch} className={styles.searchForm}>
              <Search size={16} strokeWidth={1.5} className={styles.searchIcon} />
              <input
                ref={searchRef}
                className={styles.searchInput}
                type="search"
                placeholder="Search silk, linen, robes..."
                autoComplete="off"
              />
            </form>
            <button className={styles.iconBtn} onClick={() => setSearchOpen(false)} aria-label="Close search">
              <X size={20} strokeWidth={1.5} />
            </button>
          </div>
        ) : (
          <>
            {/* Logo — left */}
            <Link href="/" className={styles.logoLink}>
              <span className={styles.logoText}>SILKILINEN</span>
              <span className={styles.logoSub}>Silk &amp; Linen</span>
            </Link>

            {/* Right icons */}
            <div className={styles.navRight}>
              <button className={styles.iconBtn} onClick={() => setSearchOpen(true)} aria-label="Search">
                <Search size={20} strokeWidth={1.5} />
              </button>

              {customer ? (
                <div className={styles.accountWrap} ref={dropdownRef}>
                  <button
                    className={styles.iconBtn}
                    onClick={() => setAccountOpen(o => !o)}
                    aria-label="Account menu"
                  >
                    <span className={styles.accountAvatar}>{avatarLetter}</span>
                  </button>
                  {accountOpen && (
                    <div className={styles.accountDropdown}>
                      <a href="/account" className={styles.dropItem}>My account</a>
                      <a href="/account/orders" className={styles.dropItem}>Orders</a>
                      <a href="/wishlist" className={styles.dropItem}>
                        Wishlist{wishlistCount > 0 ? ` (${wishlistCount})` : ''}
                      </a>
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
                <a href="/account/sign-in" className={styles.iconBtn} aria-label="Sign in">
                  <User size={20} strokeWidth={1.5} />
                </a>
              )}

              <button
                className={styles.iconBtn}
                onClick={() => setCartOpen(true)}
                aria-label={`Cart${cartCount > 0 ? `, ${cartCount} item${cartCount !== 1 ? 's' : ''}` : ''}`}
              >
                <ShoppingBag size={20} strokeWidth={1.5} />
                {cartCount > 0 && <span className={styles.badge}>{cartCount}</span>}
              </button>

              <button className={styles.iconBtn} onClick={() => setMenuOpen(true)} aria-label="Open menu">
                <Menu size={20} strokeWidth={1.5} />
              </button>
            </div>
          </>
        )}
      </nav>

      <SideMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
      <CartPanel isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
