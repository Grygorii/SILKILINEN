import styles from './InstagramGrid.module.css';

const CELLS = Array.from({ length: 6 });

export default function InstagramGrid() {
  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>@silkilinen</h2>
        <p className={styles.sub}>Follow along for daily inspiration</p>
      </div>
      <div className={styles.grid}>
        {CELLS.map((_, i) => (
          <div key={i} className={styles.cell} />
        ))}
      </div>
      <div className={styles.footer}>
        <a
          href="https://instagram.com"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.followBtn}
        >
          Follow on Instagram
        </a>
      </div>
    </section>
  );
}
