import styles from './AnnouncementBar.module.css';

export default function AnnouncementBar() {
  return (
    <div className={styles.bar}>
      <p>New to Silkilinen? Enjoy <strong>10% off</strong> your first order — use code <strong>SILK10</strong></p>
    </div>
  );
}