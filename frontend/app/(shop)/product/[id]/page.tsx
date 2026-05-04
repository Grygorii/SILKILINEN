import type { Metadata } from 'next';
import styles from './page.module.css';
import ProductOptions from '@/components/ProductOptions';
import ProductGallery from '@/components/ProductGallery';
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

function getMaterialSub(mat?: string): string {
  if (!mat) return '';
  const m = mat.toLowerCase();
  if (m.includes('mulberry silk')) return 'In Mulberry Silk';
  if (m.includes('silk satin')) return 'In Silk Satin';
  if (m.includes('silk') && m.includes('linen')) return 'In Silk & Linen';
  if (m.includes('silk')) return 'In Pure Silk';
  if (m.includes('linen')) return 'In Pure Linen';
  return '';
}

function StockBadge({ product }: { product: { inStock?: boolean; totalStock?: number; stockLevel?: number } }) {
  const total = product.totalStock ?? product.stockLevel ?? null;
  if (total === null) return null;
  if (total === 0) return <p className={styles.stockOut}>Out of stock</p>;
  if (total <= 3) return <p className={styles.stockLow}>Only {total} left</p>;
  return null;
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

  const total = product.totalStock ?? product.stockLevel ?? null;
  const outOfStock = total === 0;
  const materialSub = getMaterialSub(product.materialComposition);
  const showNew = product.createdAt
    ? Date.now() - new Date(product.createdAt).getTime() < 30 * 86_400_000
    : false;

  const galleryImages = product.images?.length > 0
    ? product.images
    : product.image
      ? [{ url: product.image, alt: product.name }]
      : [];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || '',
    image: galleryImages[0]?.url || undefined,
    brand: { '@type': 'Brand', name: 'SILKILINEN' },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'EUR',
      price: Number(product.price).toFixed(2),
      availability: outOfStock
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
          {/* Gallery */}
          <div className={styles.galleryCol}>
            <ProductGallery
              images={galleryImages}
              name={product.name}
              productId={product._id}
            />
          </div>

          {/* Info */}
          <div className={styles.infoCol}>
            <a href="/shop" className={styles.back}>← Back to shop</a>

            {showNew && <span className={styles.newTag}>new</span>}
            <h1 className={styles.productName}>{product.name}</h1>
            {materialSub && <p className={styles.materialSub}>{materialSub}</p>}

            <p className={styles.price}>
              <span className={product.compareAtPrice && product.compareAtPrice > product.price ? styles.priceSale : ''}>
                €{Number(product.price).toFixed(2)}
              </span>
              {product.compareAtPrice && product.compareAtPrice > product.price && (
                <span className={styles.priceCompare}>€{Number(product.compareAtPrice).toFixed(2)}</span>
              )}
            </p>

            <StockBadge product={product} />

            <ProductOptions
              colours={product.colours ?? []}
              sizes={product.sizes ?? []}
              productName={product.name}
              productId={product._id}
              price={product.price}
              outOfStock={outOfStock}
            />

            {/* Accordions */}
            <div className={styles.accordions}>
              {product.description && (
                <details className={styles.accordion}>
                  <summary className={styles.accordionSummary}>PRODUCT DETAILS</summary>
                  <p className={styles.accordionBody}>{product.description}</p>
                </details>
              )}
              {(product.materialComposition || product.careInstructions) && (
                <details className={styles.accordion}>
                  <summary className={styles.accordionSummary}>MATERIAL AND CARE</summary>
                  <div className={styles.accordionBody}>
                    {product.materialComposition && <p>{product.materialComposition}</p>}
                    {product.careInstructions && <p style={{ marginTop: '8px' }}>{product.careInstructions}</p>}
                  </div>
                </details>
              )}
              <details className={styles.accordion}>
                <summary className={styles.accordionSummary}>DELIVERY & RETURNS</summary>
                <p className={styles.accordionBody}>
                  We ship from Dublin, Ireland worldwide. Standard delivery 5–10 business days. Express shipping available at checkout. Returns accepted within 14 days of delivery for unworn items in their original condition.
                </p>
              </details>
              <details className={styles.accordion}>
                <summary className={styles.accordionSummary}>GIFT PACKAGING</summary>
                <p className={styles.accordionBody}>
                  Every order is wrapped in our signature tissue-lined box with ribbon — ready for gifting. Add a personal note in the order notes at checkout.
                </p>
              </details>
            </div>
          </div>
        </div>
      </main>

      <CrossSell productId={id} />
      <RecentlyViewed excludeId={id} />
    </>
  );
}
