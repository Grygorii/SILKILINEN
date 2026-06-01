import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProductGrid from '@/components/ProductGrid';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type CollectionProduct = {
  _id: string;
  name: string;
  price: number;
  category: string;
  colours: string[];
  sizes: string[];
  description: string;
  materialComposition?: string;
  createdAt?: string;
  images?: { url: string; isPrimary?: boolean; alt?: string }[];
  image?: string;
};

type CollectionData = {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  heroImage?: { url: string; alt?: string };
  metaTitle?: string;
  metaDescription?: string;
  products: CollectionProduct[];
};

async function getCollection(slug: string): Promise<CollectionData | null> {
  try {
    const res = await fetch(`${API}/api/collections/${slug}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollection(slug);
  if (!collection) return { title: 'Collection Not Found' };

  const title = collection.metaTitle || `${collection.name} — SILKILINEN`;
  const description = collection.metaDescription || collection.description
    || `Shop the ${collection.name} collection at SILKILINEN. Pure silk and linen intimates, shipped worldwide from Donegal.`;

  return {
    title,
    description,
    alternates: { canonical: `https://www.silkilinen.com/collections/${slug}` },
    openGraph: {
      title,
      description,
      url: `https://www.silkilinen.com/collections/${slug}`,
      siteName: 'SILKILINEN',
    },
  };
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const collection = await getCollection(slug);

  if (!collection) notFound();

  return (
    <main className={styles.page}>
      {collection.heroImage?.url && (
        <div className={styles.hero}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={collection.heroImage.url}
            alt={collection.heroImage.alt || collection.name}
            className={styles.heroImg}
          />
          <div className={styles.heroOverlay}>
            <h1 className={styles.heroTitle}>{collection.name}</h1>
          </div>
        </div>
      )}

      <div className={styles.pageHeader}>
        {!collection.heroImage?.url && (
          <h1 className={styles.title}>{collection.name}</h1>
        )}
        {collection.description && (
          <p className={styles.description}>{collection.description}</p>
        )}
      </div>

      {collection.products.length === 0 ? (
        <p className={styles.empty}>No products in this collection yet.</p>
      ) : (
        <ProductGrid products={collection.products} />
      )}
    </main>
  );
}
