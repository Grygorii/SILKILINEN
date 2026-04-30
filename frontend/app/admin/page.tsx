import styles from './page.module.css';

export default function AdminDashboard() {
  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>
          <h1>SILKILINEN</h1>
          <p>Admin Panel</p>
        </div>
        <nav className={styles.sidebarNav}>
          <a href="/admin" className={styles.navItem}>📊 Dashboard</a>
          <a href="/admin/products" className={styles.navItem}>👗 Products</a>
          <a href="/admin/orders" className={styles.navItem}>📦 Orders</a>
          <a href="/admin/settings" className={styles.navItem}>⚙️ Settings</a>
        </nav>
        <a href="/admin/login" className={styles.logout}>Sign out</a>
      </aside>
      <main className={styles.main}>
        <h2>Dashboard</h2>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span>10</span>
            <p>Products</p>
          </div>
          <div className={styles.stat}>
            <span>0</span>
            <p>Orders</p>
          </div>
          <div className={styles.stat}>
            <span>€0</span>
            <p>Revenue</p>
          </div>
        </div>
      </main>
    </div>
  );
}