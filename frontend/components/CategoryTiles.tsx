import Link from 'next/link';
import { type Content, val } from '@/lib/content';
import styles from './CategoryTiles.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Category = { slug: string; label: string; count: number };

async function getCategories(): Promise<Category[]> {
  try {
    const res = await fetch(`${API}/api/categories`, { next: { revalidate: 3600 } });
    return res.ok ? res.json() : [];
  } catch {
    return [];
  }
}

export default async function CategoryTiles({ content = {} }: { content?: Content }) {
  const categories = await getCategories();
  const tiles = categories
    .filter(c => c.count > 0)
    .map(c => ({
      slug: c.slug,
      label: val(content, `category_tile_${c.slug}_title`, c.label),
      image: val(content, `category_tile_${c.slug}_image`),
      alt: content[`category_tile_${c.slug}_image`]?.altText || c.label,
    }));

  if (tiles.length === 0) return null;

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Shop by Category</h2>
      <div className={styles.grid}>
        {tiles.map(tile => (
          <Link
            key={tile.slug}
            href={`/shop?category=${tile.slug}`}
            className={`${styles.tile} ${tile.image ? styles.tileWithImage : ''}`}
          >
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
