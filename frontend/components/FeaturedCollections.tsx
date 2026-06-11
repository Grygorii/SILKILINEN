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
      next: { revalidate: 3600 },
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

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Collections</h2>
      <div className={styles.grid}>
        {collections.map((c) => (
          <Link key={c._id} href={`/collections/${c.slug}`} className={styles.tile}>
            {c.heroImage?.url ? (
              <div className={styles.imgWrap}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <Image
                  src={c.heroImage.url}
                  alt={c.heroImage.alt || c.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
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
