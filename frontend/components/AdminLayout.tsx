import styles from './AdminLayout.module.css';
import LogoutButton from './LogoutButton';

type Props = {
  children: React.ReactNode;
  active?: string;
};

export default function AdminLayout({ children, active }: Props) {
  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>
          <h1>SILKILINEN</h1>
          <p>Admin Panel</p>
        </div>
        <nav className={styles.sidebarNav}>
          <a href="/admin" className={`${styles.navItem} ${active === 'dashboard' ? styles.active : ''}`}>📊 Dashboard</a>
          <a href="/admin/products" className={`${styles.navItem} ${active === 'products' ? styles.active : ''}`}>👗 Products</a>
          <a href="/admin/orders" className={`${styles.navItem} ${active === 'orders' ? styles.active : ''}`}>📦 Orders</a>
          <a href="/admin/settings" className={`${styles.navItem} ${active === 'settings' ? styles.active : ''}`}>⚙️ Settings</a>
        </nav>
        <div className={styles.sidebarDivider} />
        <LogoutButton />
      </aside>
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}