import type { Metadata } from 'next';
import styles from './page.module.css';
import ProductOptions from '@/components/ProductOptions';
import CrossSell from '@/components/CrossSell';
import RecentlyViewed from '@/components/RecentlyViewed';
import ReviewsSection from '@/components/ReviewsSection';
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
  const primaryImage = product.images?.find((i: { isPrimary: boolean }) => i.isPrimary);
  const image = primaryImage?.url || product.images?.[0]?.url || product.image || 'https://silkilinen.vercel.app/og-default.jpg';

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

function StockBadge({ product }: { product: { inStock?: boolean; totalStock?: number; stockLevel?: number } }) {
  const total = product.totalStock ?? product.stockLevel ?? null;
  if (total === null) return null;
  if (total === 0) return <p className={styles.stockOut}>Out of stock</p>;
  if (total <= 3) return <p className={styles.stockLow}>Low stock — only {total} left</p>;
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
  const primaryImage = product.images?.find((i: { isPrimary: boolean }) => i.isPrimary);
  const heroImage = primaryImage?.url || product.images?.[0]?.url || product.image || '';
  const heroAlt = primaryImage?.alt || product.altText || product.name;
  const total = product.totalStock ?? product.stockLevel ?? null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || '',
    image: heroImage || undefined,
    brand: { '@type': 'Brand', name: 'SILKILINEN' },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'EUR',
      price: Number(product.price).toFixed(2),
      availability: total === 0
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
            {heroImage ? (
              <img src={heroImage} alt={heroAlt} className={styles.heroImg} />
            ) : (
              <div className={styles.placeholder} />
            )}
          </div>
          <div className={styles.info}>
            <a href="/shop" className={styles.back}>← Back to shop</a>
            <h1>{product.name}</h1>
            <p className={styles.price}>
              <span className={product.compareAtPrice ? styles.priceSale : ''}>
                €{Number(product.price).toFixed(2)}
              </span>
              {product.compareAtPrice && product.compareAtPrice > product.price && (
                <span className={styles.priceCompare}>€{Number(product.compareAtPrice).toFixed(2)}</span>
              )}
            </p>
            <StockBadge product={product} />
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

            {(product.materialComposition || product.careInstructions) && (
              <div className={styles.materialSection}>
                {product.materialComposition && (
                  <details className={styles.accordion}>
                    <summary className={styles.accordionSummary}>Material</summary>
                    <p className={styles.accordionBody}>{product.materialComposition}</p>
                  </details>
                )}
                {product.careInstructions && (
                  <details className={styles.accordion}>
                    <summary className={styles.accordionSummary}>Care</summary>
                    <p className={styles.accordionBody}>{product.careInstructions}</p>
                  </details>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
      <CrossSell productId={id} />
      <RecentlyViewed excludeId={id} />
      <ReviewsSection />
    </>
  );
}
