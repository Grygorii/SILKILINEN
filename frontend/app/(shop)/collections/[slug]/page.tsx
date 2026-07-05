import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import CollectionSet from './CollectionSet';
import Breadcrumbs from '@/components/Breadcrumbs';
import Image from 'next/image';
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
  discountPercent?: number;
  products: CollectionProduct[];
};

async function getCollection(slug: string): Promise<CollectionData | null> {
  try {
    const res = await fetch(`${API}/api/collections/${slug}`, { next: { revalidate: 120 } });
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

  // Absolute title: the root layout template appends " | Silkilinen" to any
  // non-absolute title, which double-branded the collection ("… — SILKILINEN |
  // Silkilinen") and pushed it past 60 chars. Set it absolute so the brand
  // appears exactly once.
  const brandedTitle = collection.metaTitle || `${collection.name} — SILKILINEN`;
  const description = collection.metaDescription || collection.description
    || `Shop the ${collection.name} collection at SILKILINEN. Pure silk and linen intimates, shipped worldwide from Donegal.`;

  return {
    title: { absolute: brandedTitle },
    description,
    alternates: { canonical: `https://www.silkilinen.com/collections/${slug}` },
    openGraph: {
      title: brandedTitle,
      description,
      url: `https://www.silkilinen.com/collections/${slug}`,
      siteName: 'Silkilinen',
    },
  };
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const collection = await getCollection(slug);

  if (!collection) notFound();

  return (
    <main className={styles.page}>
      <Breadcrumbs
        items={[{ label: 'Home', href: '/' }, { label: 'Shop', href: '/shop' }, { label: collection.name }]}
        withSchema
      />
      {collection.heroImage?.url && (
        <div className={styles.hero}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <Image
            src={collection.heroImage.url}
            alt={collection.heroImage.alt || collection.name}
            fill
            priority
            sizes="100vw"
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
        {(collection.discountPercent ?? 0) > 0 && (
          <p style={{ marginTop: 12, fontSize: 13, color: 'var(--muted, #8a8680)', letterSpacing: '0.3px', fontStyle: 'italic' }}>
            Taken as a set, {collection.discountPercent}% below buying each piece — reflected at checkout.
          </p>
        )}
      </div>

      {collection.products.length === 0 ? (
        <p className={styles.empty}>No products in this collection yet.</p>
      ) : (
        <CollectionSet products={collection.products} discountPercent={collection.discountPercent ?? 0} />
      )}
    </main>
  );
}
