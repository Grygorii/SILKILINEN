import Link from 'next/link';
import Image from 'next/image';
import styles from './FeaturedCollections.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Collection = {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  heroImage?: { url: string; alt?: string };
};

async function getFeaturedCollections(): Promise<Collection[]> {
  try {
    const res = await fetch(`${API}/api/collections/featured`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function FeaturedCollections() {
  const collections = await getFeaturedCollections();
  if (collections.length === 0) return null;

  // Match the actual one/two/three-column layout so wider desktop tiles do
  // not keep requesting a small 33vw image. The image itself is unchanged.
  const desktopSizes = collections.length === 1
    ? '960px'
    : collections.length === 2
      ? '(min-width: 1920px) 884px, 47vw'
      : '(min-width: 1920px) 582px, 31vw';
  const imageSizes = `(max-width: 540px) 90vw, (max-width: 900px) 44vw, ${desktopSizes}`;

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Collections</h2>
      <div className={styles.grid}>
        {collections.map((c) => (
          <Link key={c._id} href={`/collections/${c.slug}`} className={styles.tile}>
            {c.heroImage?.url ? (
              <div className={styles.imgWrap}>
                { }
                <Image
                  src={c.heroImage.url}
                  alt={c.heroImage.alt || c.name}
                  fill
                  sizes={imageSizes}
                  className={styles.img}
                />
              </div>
            ) : (
              <div className={styles.imgPlaceholder} />
            )}
            <div className={styles.tileBody}>
              <p className={styles.tileName}>{c.name}</p>
              {c.description && <p className={styles.tileDesc}>{c.description}</p>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
