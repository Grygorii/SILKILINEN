'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './AdminLayout.module.css';
import LogoutButton from './LogoutButton';
import AdminNotifications from './AdminNotifications';

type Props = {
  children: React.ReactNode;
  active?: string;
};

export default function AdminLayout({ children, active }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={styles.layout}>
      {sidebarOpen && (
        <div className={styles.mobileOverlay} onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <button
          className={styles.sidebarClose}
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
        >
          ✕
        </button>
        <Link href="/" className={styles.sidebarLogoLink}>
          <div className={styles.sidebarLogo}>
            <h1>SILKILINEN</h1>
            <p>Admin Panel</p>
          </div>
        </Link>
        <nav className={styles.sidebarNav}>
          <a href="/admin" className={`${styles.navItem} ${active === 'dashboard' ? styles.active : ''}`}>📊 Dashboard</a>
          <a href="/admin/products" className={`${styles.navItem} ${active === 'products' ? styles.active : ''}`}>👗 Products</a>
          <a href="/admin/import" className={`${styles.navItem} ${active === 'import' ? styles.active : ''}`}>📥 Import products</a>
          <a href="/admin/orders" className={`${styles.navItem} ${active === 'orders' ? styles.active : ''}`}>📦 Orders</a>
          <a href="/admin/promo-codes" className={`${styles.navItem} ${active === 'promo-codes' ? styles.active : ''}`}>🏷️ Promo Codes</a>
          <a href="/admin/models" className={`${styles.navItem} ${active === 'models' ? styles.active : ''}`}>🤖 AI Models</a>
          <a href="/admin/settings" className={`${styles.navItem} ${active === 'settings' ? styles.active : ''}`}>⚙️ Settings</a>
        </nav>
        <div className={styles.sidebarDivider} />
        <LogoutButton />
      </aside>

      <main className={styles.main}>
        <button
          className={styles.mobileMenuBtn}
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
        {children}
      </main>
      <AdminNotifications />
    </div>
  );
}
