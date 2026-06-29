'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Search, User, ShoppingBag, Menu, X, Heart } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useCustomer } from '@/context/CustomerContext';
import CartPanel from './CartPanel';
import SideMenu from './SideMenu';
import styles from './Navbar.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

// Structural links bracket the dynamic category links pulled from the backend,
// so the header reflects the real categories (with products) instead of a
// hardcoded list that drifts whenever categories are renamed/added.
const NAV_BEFORE = [{ label: 'Shop', href: '/shop' }];
const NAV_AFTER = [
  { label: 'Journal', href: '/journal' },
  { label: 'About', href: '/about' },
];
// Cap how many categories show in the top bar so the header doesn't overflow;
// the admin curates which appear via category display order.
const MAX_NAV_CATEGORIES = 4;

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
  const router = useRouter();
  const pathname = usePathname();

  // Live categories for the desktop nav (same source the side menu uses).
  const [navCategories, setNavCategories] = useState<{ slug: string; label: string }[]>([]);
  useEffect(() => {
    fetch(`${API}/api/categories`)
      .then(r => (r.ok ? r.json() : []))
      .then((data: { slug: string; label: string; count: number }[]) => {
        setNavCategories(
          (Array.isArray(data) ? data : [])
            .filter(c => c.count > 0)
            .slice(0, MAX_NAV_CATEGORIES)
            .map(c => ({ slug: c.slug, label: c.label })),
        );
      })
      .catch(() => {});
  }, []);

  const desktopNav = [
    ...NAV_BEFORE,
    ...navCategories.map(c => ({ label: c.label, href: `/shop?category=${c.slug}` })),
    ...NAV_AFTER,
  ];

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
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setAccountOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
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
      router.push(`/shop?q=${encodeURIComponent(q)}`);
      setSearchOpen(false);
    }
  }

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
            {/* Left — hamburger (mobile) + logo (desktop). Logo-left on desktop
                balances the header like the editorial benchmarks. */}
            <div className={styles.navLeft}>
              <button className={`${styles.iconBtn} ${styles.hamburger}`} onClick={() => setMenuOpen(true)} aria-label="Open menu">
                <Menu size={20} strokeWidth={1.5} />
              </button>
              <Link href="/" className={`${styles.logoLink} ${styles.logoDesktop}`}>
                <span className={styles.logoText}>SILKILINEN</span>
                <span className={styles.logoSub}>Silk &amp; Linen</span>
              </Link>
            </div>

            {/* Centre — logo (mobile) + nav (desktop) */}
            <div className={styles.navCenter}>
              <Link href="/" className={`${styles.logoLink} ${styles.logoMobile}`}>
                <span className={styles.logoText}>SILKILINEN</span>
                <span className={styles.logoSub}>Silk &amp; Linen</span>
              </Link>
              <nav className={styles.desktopNav} aria-label="Main navigation">
                {desktopNav.map(({ label, href }) => {
                  const active = pathname === href || (href !== '/shop' && pathname.startsWith(href.split('?')[0]));
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`${styles.desktopNavLink} ${active ? styles.desktopNavLinkActive : ''}`}
                    >
                      {label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Right — search, wishlist, account, cart */}
            <div className={styles.navRight}>
              <button className={`${styles.iconBtn} ${styles.desktopOnly}`} onClick={() => setSearchOpen(true)} aria-label="Search">
                <Search size={20} strokeWidth={1.5} />
              </button>

              <Link
                href="/wishlist"
                className={styles.iconBtn}
                aria-label={`Wishlist${wishlistCount > 0 ? `, ${wishlistCount} item${wishlistCount !== 1 ? 's' : ''}` : ''}`}
              >
                <Heart size={20} strokeWidth={1.5} fill="none" />
                {wishlistCount > 0 && <span className={styles.badge}>{wishlistCount}</span>}
              </Link>

              <div className={`${styles.accountWrap} ${styles.desktopOnly}`} ref={dropdownRef}>
                <button
                  className={styles.iconBtn}
                  onClick={() => setAccountOpen(o => !o)}
                  aria-label={customer ? 'Account menu' : 'Sign in'}
                  aria-expanded={accountOpen}
                  aria-haspopup="true"
                >
                  <User size={20} strokeWidth={1.5} />
                </button>
                {accountOpen && (
                  <div className={styles.accountDropdown} role="menu">
                    {customer ? (
                      <>
                        <div className={styles.dropGreeting}>
                          Hi, {customer.firstName || customer.email}
                        </div>
                        <a href="/account" className={styles.dropItem} role="menuitem" onClick={() => setAccountOpen(false)}>My account</a>
                        <a href="/account/orders" className={styles.dropItem} role="menuitem" onClick={() => setAccountOpen(false)}>Orders</a>
                        <a href="/wishlist" className={styles.dropItem} role="menuitem" onClick={() => setAccountOpen(false)}>
                          Wishlist{wishlistCount > 0 ? ` (${wishlistCount})` : ''}
                        </a>
                        <a href="/account/profile" className={styles.dropItem} role="menuitem" onClick={() => setAccountOpen(false)}>Profile</a>
                        <div className={styles.dropDivider} />
                        <button
                          className={styles.dropSignOut}
                          role="menuitem"
                          onClick={async () => { await signOut(); setAccountOpen(false); window.location.href = '/'; }}
                        >
                          Sign out
                        </button>
                      </>
                    ) : (
                      <>
                        <a href="/account/sign-in" className={styles.dropItem} role="menuitem" onClick={() => setAccountOpen(false)}>Sign in</a>
                        <a href="/account/sign-in" className={styles.dropItem} role="menuitem" onClick={() => setAccountOpen(false)}>Create account</a>
                      </>
                    )}
                  </div>
                )}
              </div>

              <button
                className={styles.iconBtn}
                onClick={() => setCartOpen(true)}
                aria-label={`Cart${cartCount > 0 ? `, ${cartCount} item${cartCount !== 1 ? 's' : ''}` : ''}`}
              >
                <ShoppingBag size={20} strokeWidth={1.5} />
                {cartCount > 0 && <span className={styles.badge}>{cartCount}</span>}
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
