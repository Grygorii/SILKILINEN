import Link from 'next/link';
import styles from './CategoryTiles.module.css';

const TILES = [
  { label: 'Robes' },
  { label: 'Dresses' },
  { label: 'Shorts' },
  { label: 'Shirts' },
  { label: 'Scarves' },
];

export default function CategoryTiles() {
  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Shop by Category</h2>
      <div className={styles.grid}>
        {TILES.map(tile => (
          <Link key={tile.label} href="/shop" className={styles.tile}>
            <span className={styles.label}>{tile.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
