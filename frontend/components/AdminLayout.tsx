'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Package, FileText, Users,
  Megaphone, Settings, Menu, Bell, X, Layers, Tag, BookOpen, BookMarked, Share2,
  Folder, Gift, Activity, Image as ImageIcon, ShoppingBag, Star, Upload, Boxes, Truck, Sparkles, Zap, Search, Percent,
} from 'lucide-react';
import styles from './AdminLayout.module.css';
import LogoutButton from './LogoutButton';
import AdminNotifications from './AdminNotifications';
import AdminToastHost from './AdminToastHost';
import CommandPalette from './CommandPalette';
import paletteStyles from './CommandPalette.module.css';

type NavEntry =
  | { section: string }
  | { label: string; href: string; icon: React.ElementType; exact?: boolean };

// Grouped by what the task actually is, not by an abstract "publish" bucket —
// so the catalogue, the things that sell, marketing, and content each have a
// home you can scan in one glance.
const NAV: NavEntry[] = [
  { section: 'Core' },
  { label: 'Dashboard',  href: '/admin',            icon: LayoutDashboard, exact: true },
  { label: 'Ask AI',     href: '/admin/analyst',    icon: Sparkles },
  { label: 'Growth Engine', href: '/admin/growth',  icon: Zap },
  { label: 'Orders',     href: '/admin/orders',     icon: ShoppingBag },
  { label: 'Customers',  href: '/admin/customers',  icon: Users },
  { label: 'Reviews',    href: '/admin/reviews',    icon: Star },
  { section: 'Catalogue' },
  { label: 'Products',    href: '/admin/products',    icon: Package },
  { label: 'Inventory',   href: '/admin/inventory',   icon: Boxes },
  { label: 'Categories',  href: '/admin/categories',  icon: Folder },
  { label: 'Collections', href: '/admin/collections', icon: Layers },
  { label: 'Bundles',     href: '/admin/bundles',     icon: Gift },
  { label: 'Import',      href: '/admin/import',      icon: Upload },
  { section: 'Marketing' },
  { label: 'Marketing',   href: '/admin/marketing',    icon: Megaphone },
  { label: 'SEO',         href: '/admin/seo',          icon: Search },
  { label: 'Promo codes', href: '/admin/promo-codes',  icon: Tag },
  { label: 'Social',      href: '/admin/social',       icon: Share2 },
  { label: 'Image Studio', href: '/admin/social-assets', icon: ImageIcon },
  { section: 'Content' },
  { label: 'Site Content', href: '/admin/content',     icon: FileText },
  { label: 'Journal',      href: '/admin/journal',     icon: BookOpen },
  { label: 'Pages',        href: '/admin/pages',       icon: FileText },
  { section: 'Finance' },
  { label: 'Overview',   href: '/admin/finance',           icon: BookMarked, exact: true },
  { label: 'Expenses',   href: '/admin/finance/expenses',  icon: BookMarked },
  { label: 'Reports',    href: '/admin/finance/reports',   icon: BookMarked },
  { section: 'Config' },
  { label: 'Business & offers', href: '/admin/settings/business', icon: Percent },
  { label: 'Shipping',   href: '/admin/settings/shipping', icon: Truck },
  { label: 'Site Audit', href: '/admin/settings/advanced/site-audit', icon: Activity },
  { label: 'Settings',   href: '/admin/settings',   icon: Settings, exact: true },
];

const TABS = [
  { label: 'Home',      href: '/admin',           icon: LayoutDashboard, exact: true },
  { label: 'Products',  href: '/admin/products',  icon: Package },
  { label: 'Orders',    href: '/admin/orders',    icon: FileText },
  { label: 'Marketing', href: '/admin/marketing', icon: Megaphone },
  { label: 'Settings',  href: '/admin/settings',  icon: Settings },
] as const;

function isActive(href: string, pathname: string, exact = false): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + '/');
}

function isTabActive(tab: (typeof TABS)[number], pathname: string): boolean {
  if (tab.href === '/admin/products') {
    return pathname.startsWith('/admin/products') || pathname.startsWith('/admin/import');
  }
  return isActive(tab.href, pathname, 'exact' in tab ? tab.exact : false);
}

export default function AdminLayout({
  children,
  active: _ignored,
}: {
  children: React.ReactNode;
  active?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.layout}>
      {/* Sidebar (desktop fixed, mobile drawer) */}
      <aside className={`${styles.sidebar} ${open ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarInner}>
          <button
            className={styles.sidebarClose}
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>

          <Link href="/" className={styles.logo}>
            <p className={styles.logoTitle}>SILKILINEN</p>
            <p className={styles.logoSub}>Admin Panel</p>
          </Link>

          <button
            className={paletteStyles.trigger}
            onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
          >
            <span>Search</span>
            <span className={paletteStyles.triggerKey}>⌘K</span>
          </button>

          <nav className={styles.nav}>
            {NAV.map((entry, i) => {
              if ('section' in entry) {
                return <p key={i} className={styles.navSection}>{entry.section}</p>;
              }
              const Icon = entry.icon;
              const active = isActive(entry.href, pathname, entry.exact);
              return (
                <Link
                  key={entry.href}
                  href={entry.href}
                  className={`${styles.navItem} ${active ? styles.navActive : ''}`}
                  onClick={() => setOpen(false)}
                >
                  <Icon size={15} />
                  {entry.label}
                </Link>
              );
            })}
          </nav>

          <div className={styles.sidebarFooter}>
            <LogoutButton />
          </div>
        </div>
      </aside>

      {/* Mobile drawer backdrop */}
      {open && <div className={styles.overlay} onClick={() => setOpen(false)} />}

      {/* Mobile top bar */}
      <header className={styles.topbar}>
        <button className={styles.topbarBtn} onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu size={20} />
        </button>
        <span className={styles.topbarLogo}>SILKILINEN</span>
        <button className={styles.topbarBtn} aria-label="Notifications">
          <Bell size={20} />
        </button>
      </header>

      {/* Page content */}
      <main className={styles.main}>
        {children}
      </main>

      {/* Mobile bottom tabs */}
      <nav className={styles.bottomTabs}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = isTabActive(tab, pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`${styles.tab} ${active ? styles.tabActive : ''}`}
            >
              <Icon size={20} />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <AdminNotifications />
      <AdminToastHost />
      <CommandPalette />
    </div>
  );
}
