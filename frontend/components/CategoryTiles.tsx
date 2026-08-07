import Link from 'next/link';
import Image from 'next/image';
import { type Content, val } from '@/lib/content';
import { categoryPath } from '@/lib/urls';
import styles from './CategoryTiles.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Category = {
  slug: string;
  label: string;
  count: number;
  heroImage?: { url?: string; alt?: string } | null;
  sampleImage?: { url?: string; alt?: string } | null;
};

async function getCategories(): Promise<Category[]> {
  try {
    const res = await fetch(`${API}/api/categories`, { next: { revalidate: 300 } });
    return res.ok ? res.json() : [];
  } catch {
    return [];
  }
}

/**
 * Shop-by-category tiles.
 *
 * Image precedence — the tile is NEVER empty when the category has products:
 *   1. a curated CMS image (category_tile_<slug>_image), if the founder set one
 *   2. the category's own heroImage (Admin → Categories)
 *   3. a real photo from a product in that category (served by /api/categories)
 *
 * Before this, the CMS slots were a hardcoded list that had drifted from the
 * live category slugs — only 4 of 9 categories could ever have an image and
 * there was no upload field for the rest, so the section rendered as a wall of
 * empty outlined boxes. A shop should always look like a shop.
 */
export default async function CategoryTiles({ content = {} }: { content?: Content }) {
  const categories = await getCategories();
  const tiles = categories
    .filter(c => c.count > 0)
    .map(c => {
      const cmsImage = val(content, `category_tile_${c.slug}_image`);
      const image = cmsImage || c.heroImage?.url || c.sampleImage?.url || '';
      const cmsAlt = content[`category_tile_${c.slug}_image`]?.altText;
      return {
        slug: c.slug,
        label: val(content, `category_tile_${c.slug}_title`, c.label),
        image,
        alt: cmsAlt || c.heroImage?.alt || c.sampleImage?.alt || c.label,
      };
    });

  if (tiles.length === 0) return null;

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Shop by Category</h2>
      <div className={styles.grid}>
        {tiles.map(tile => (
          <Link
            key={tile.slug}
            href={categoryPath(tile.slug)}
            className={`${styles.tile} ${tile.image ? styles.tileWithImage : ''}`}
          >
            {tile.image && (
              <Image
                src={tile.image}
                alt={tile.alt}
                fill
                sizes="(max-width: 600px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className={styles.tileImg}
              />
            )}
            <span className={styles.label}>{tile.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
