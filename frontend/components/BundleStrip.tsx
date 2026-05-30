import Link from 'next/link';
import { isValidImageUrl } from '@/lib/imageUtils';
import styles from './BundleStrip.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type BundleProduct = { _id: string; images?: { url: string; isPrimary?: boolean }[] };
type Bundle = {
  _id: string;
  name: string;
  slug: string;
  heroImage?: { url: string; alt?: string } | null;
  bundlePrice: number;
  originalTotal: number;
  savings: number;
  discountPercent: number;
  products: BundleProduct[];
};

async function getBundles(category: string): Promise<Bundle[]> {
  try {
    const res = await fetch(`${API}/api/bundles?category=${encodeURIComponent(category)}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

/**
 * Renders the active bundles tagged with a given category as a horizontal
 * strip above the shop product grid. Lets a customer browsing e.g. robes
 * see the curated robe bundle too. Returns null (renders nothing) when no
 * bundles are tagged with the category — so it's safe to drop into every
 * category page unconditionally.
 */
export default async function BundleStrip({ category }: { category: string }) {
  const bundles = await getBundles(category);
  if (bundles.length === 0) return null;

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Bundles</h2>
      <div className={styles.row}>
        {bundles.map(b => {
          const hero = b.heroImage?.url
            || b.products.find(p => isValidImageUrl(p.images?.[0]?.url))?.images?.[0]?.url
            || null;
          return (
            <Link key={b._id} href={`/bundles/${b.slug}`} className={styles.card}>
              <div className={styles.imgWrap}>
                {hero ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={hero} alt={b.heroImage?.alt || b.name} className={styles.img} />
                ) : (
                  <div className={styles.imgPlaceholder} />
                )}
                <span className={styles.badge}>Save {b.discountPercent}%</span>
              </div>
              <p className={styles.name}>{b.name}</p>
              <p className={styles.priceRow}>
                <span className={styles.price}>€{b.bundlePrice.toFixed(2)}</span>
                {b.originalTotal > b.bundlePrice && (
                  <span className={styles.was}>€{b.originalTotal.toFixed(2)}</span>
                )}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
