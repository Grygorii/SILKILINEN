import Link from 'next/link';
import { type Content, val } from '@/lib/content';
import styles from './CategoryTiles.module.css';

const DEFAULT_TILES = [
  { key: 'robes',   label: 'Robes' },
  { key: 'dresses', label: 'Dresses' },
  { key: 'shorts',  label: 'Shorts' },
  { key: 'shirts',  label: 'Shirts' },
  { key: 'scarves', label: 'Scarves' },
];

export default function CategoryTiles({ content = {} }: { content?: Content }) {
  const tiles = DEFAULT_TILES.map(t => ({
    label: val(content, `category_tile_${t.key}_title`, t.label),
    image: val(content, `category_tile_${t.key}_image`),
    alt:   content[`category_tile_${t.key}_image`]?.altText || t.label,
    slug:  t.key,
  }));

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Shop by Category</h2>
      <div className={styles.grid}>
        {tiles.map(tile => (
          <Link key={tile.slug} href="/shop" className={`${styles.tile} ${tile.image ? styles.tileWithImage : ''}`}>
            {tile.image && (
              <img src={tile.image} alt={tile.alt} className={styles.tileImg} />
            )}
            <span className={styles.label}>{tile.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
