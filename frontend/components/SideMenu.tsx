'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { X, Heart, User } from 'lucide-react';
import { useCustomer } from '@/context/CustomerContext';
import { useWishlist } from '@/context/WishlistContext';
import styles from './SideMenu.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Category = { slug: string; label: string; count: number };

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function SideMenu({ isOpen, onClose }: Props) {
  const { customer } = useCustomer();
  const { count: wishlistCount } = useWishlist();
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetch(`${API}/api/categories`)
      .then(r => r.ok ? r.json() : [])
      .then((data: Category[]) => setCategories(data.filter(c => c.count > 0)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Focus management: save trigger, move focus into panel, restore on close
  useEffect(() => {
    if (isOpen) {
      prevFocusRef.current = document.activeElement as HTMLElement;
      const timer = setTimeout(() => {
        const panel = panelRef.current;
        if (!panel) return;
        const focusable = panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'
        );
        focusable[0]?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      prevFocusRef.current?.focus();
      prevFocusRef.current = null;
    }
  }, [isOpen]);

  // Focus trap: keep Tab cycling within the panel
  useEffect(() => {
    if (!isOpen) return;
    function trap(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [isOpen]);

  function handleSearch(e: { preventDefault(): void }) {
    e.preventDefault();
    const q = searchRef.current?.value.trim();
    if (q) {
      window.location.href = `/shop?q=${encodeURIComponent(q)}`;
      onClose();
    }
  }

  return (
    <>
      <div
        className={`${styles.overlay} ${isOpen ? styles.overlayOpen : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        ref={panelRef}
        className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.headerLogo}>SILKILINEN</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close menu">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Search */}
        <form className={styles.searchWrap} onSubmit={handleSearch}>
          <input
            ref={searchRef}
            className={styles.searchInput}
            type="search"
            placeholder="Search silk, linen, robes..."
            autoComplete="off"
          />
        </form>

        {/* Navigation */}
        <nav className={styles.nav}>
          <Link href="/shop" className={styles.navLink} onClick={onClose}>
            <span>SHOP ALL</span>
            <span className={styles.navArrow}>→</span>
          </Link>

          {categories.map(cat => (
            <Link
              key={cat.slug}
              href={`/shop?category=${cat.slug}`}
              className={styles.navLink}
              onClick={onClose}
            >
              <span>{cat.label.toUpperCase()}</span>
            </Link>
          ))}

          <Link href="/about" className={styles.navLink} onClick={onClose}>
            <span>ABOUT</span>
          </Link>
        </nav>

        {/* Spacer */}
        <div className={styles.spacer} />

        {/* Footer links */}
        <div className={styles.footer}>
          <div className={styles.footerRow}>
            <a
              href={customer ? '/account' : '/account/sign-in'}
              className={styles.footerLink}
              onClick={onClose}
            >
              <User size={15} strokeWidth={1.5} />
              <span>{customer ? 'My Account' : 'Create Account / Log in'}</span>
            </a>
            <a href="/wishlist" className={styles.footerLink} onClick={onClose}>
              <Heart size={15} strokeWidth={1.5} />
              <span>Wishlist{wishlistCount > 0 ? ` (${wishlistCount})` : ''}</span>
            </a>
          </div>
          <div className={styles.social}>
            <a href="https://instagram.com/silkilinen" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className={styles.socialLink}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><circle cx="17.5" cy="6.5" r="0.5" fill="currentColor"/></svg>
            </a>
            <a href="https://pinterest.com/silkilinen" target="_blank" rel="noopener noreferrer" aria-label="Pinterest" className={styles.socialLink}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6.48 2 2 6.48 2 12c0 4.24 2.65 7.86 6.39 9.29-.09-.78-.17-1.98.04-2.83.19-.77 1.26-5.34 1.26-5.34s-.32-.64-.32-1.59c0-1.49.86-2.6 1.93-2.6.91 0 1.35.68 1.35 1.5 0 .91-.58 2.28-.88 3.55-.25 1.06.53 1.93 1.57 1.93 1.89 0 3.16-2.42 3.16-5.28 0-2.18-1.47-3.81-4.12-3.81-3.01 0-4.9 2.25-4.9 4.77 0 .87.26 1.48.67 1.96.19.22.21.31.14.57-.05.18-.16.63-.21.8-.07.26-.28.35-.52.26-1.44-.59-2.11-2.18-2.11-3.97 0-2.95 2.49-6.51 7.44-6.51 3.99 0 6.62 2.9 6.62 6.01 0 4.12-2.28 7.21-5.63 7.21-1.13 0-2.19-.61-2.56-1.3l-.72 2.77c-.26.99-.96 2.23-1.43 2.99.87.27 1.79.41 2.74.41 5.52 0 10-4.48 10-10S17.52 2 12 2z"/></svg>
            </a>
            <a href="https://facebook.com/silkilinen" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className={styles.socialLink}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
            </a>
          </div>
          <div className={styles.country}>
            <span>Shipping: Ireland (EUR)</span>
            <span>→</span>
          </div>
        </div>
      </aside>
    </>
  );
}
