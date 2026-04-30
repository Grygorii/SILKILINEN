import AdminLayout from '@/components/AdminLayout';
import styles from './page.module.css';

export default function AdminDashboard() {
  return (
    <AdminLayout active="dashboard">
      <div className={styles.header}>
        <h2>Dashboard</h2>
      </div>
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
    </AdminLayout>
  );
}