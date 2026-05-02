import type { Metadata } from 'next';
import styles from './page.module.css';
import ProductOptions from '@/components/ProductOptions';
import CrossSell from '@/components/CrossSell';
import RecentlyViewed from '@/components/RecentlyViewed';
import ProductViewTracker from '@/components/ProductViewTracker';

const API = process.env.NEXT_PUBLIC_API_URL;

async function getProduct(id: string) {
  try {
    const res = await fetch(`${API}/api/products/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error) return null;
    return data;
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return { title: 'Product Not Found — SILKILINEN' };

  const title = product.metaTitle || `${product.name} — SILKILINEN`;
  const description = product.metaDescription
    || (product.description ? product.description.slice(0, 155) : `Shop ${product.name} at SILKILINEN. Pure silk and linen intimates, shipped worldwide from Dublin.`);
  const url = `https://silkilinen.vercel.app/product/${id}`;
  const image = product.image || 'https://silkilinen.vercel.app/og-default.jpg';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      images: [{ url: image, width: 1200, height: 630, alt: product.altText || product.name }],
      siteName: 'SILKILINEN',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
    alternates: { canonical: url },
  };
}

function StockBadge({ level }: { level: number | null }) {
  if (level === null || level === undefined) return null;
  if (level === 0) return <p className={styles.stockOut}>Out of stock</p>;
  if (level <= 3) return <p className={styles.stockLow}>Low stock — only {level} left</p>;
  return <p className={styles.stockIn}>In stock</p>;
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) {
    return (
      <main className={styles.page}>
        <div className={styles.notFound}>
          <p>This product could not be found.</p>
          <a href="/shop" className={styles.back}>← Back to shop</a>
        </div>
      </main>
    );
  }

  const hasSizes = Array.isArray(product.sizes) && product.sizes.length > 0;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || '',
    image: product.image || undefined,
    brand: { '@type': 'Brand', name: 'SILKILINEN' },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'EUR',
      price: Number(product.price).toFixed(2),
      availability: product.stockLevel === 0
        ? 'https://schema.org/OutOfStock'
        : 'https://schema.org/InStock',
      url: `https://silkilinen.vercel.app/product/${id}`,
    },
  };

  return (
    <>
      <main className={styles.page}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <ProductViewTracker id={product._id} name={product.name} price={product.price} />
        <div className={styles.inner}>
          <div className={styles.image}>
            <div className={styles.placeholder}></div>
          </div>
          <div className={styles.info}>
            <a href="/shop" className={styles.back}>← Back to shop</a>
            <h1>{product.name}</h1>
            <p className={styles.price}>
              €{Number(product.price).toFixed(2)}
            </p>
            <StockBadge level={product.stockLevel} />
            <p className={styles.description}>{product.description}</p>
            {hasSizes && (
              <a href="/size-guide" className={styles.sizeGuideLink} target="_blank" rel="noopener noreferrer">
                Size guide →
              </a>
            )}
            <ProductOptions
              colours={product.colours ?? []}
              sizes={product.sizes ?? []}
              productName={product.name}
              price={product.price}
            />
          </div>
        </div>
      </main>
      <CrossSell productId={id} />
      <RecentlyViewed excludeId={id} />
    </>
  );
}
