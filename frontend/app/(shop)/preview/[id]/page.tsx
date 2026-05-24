import type { Metadata } from 'next';
import styles from './page.module.css';
import ProductOptions from '@/components/ProductOptions';
import ProductGallery from '@/components/ProductGallery';
import StickyBuyBar from '@/components/StickyBuyBar';
import { ProductSelectionProvider } from '@/components/ProductSelectionContext';

const API = process.env.NEXT_PUBLIC_API_URL;

async function getPreviewProduct(id: string, token: string) {
  try {
    const res = await fetch(`${API}/api/products/${id}/preview?token=${encodeURIComponent(token)}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { product: null, error: data.error || 'Preview unavailable' };
    }
    return { product: await res.json(), error: null };
  } catch {
    return { product: null, error: 'Could not load preview' };
  }
}

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;

  if (!token) {
    return (
      <main className={styles.page}>
        <div className={styles.expired}>
          <p className={styles.expiredTitle}>No preview token</p>
          <p className={styles.expiredBody}>This preview link is missing its token. Generate a new preview from the admin panel.</p>
          <a href="/admin/products" className={styles.back}>← Back to admin</a>
        </div>
      </main>
    );
  }

  const { product, error } = await getPreviewProduct(id, token);

  if (!product) {
    return (
      <main className={styles.page}>
        <div className={styles.expired}>
          <p className={styles.expiredTitle}>Preview link expired</p>
          <p className={styles.expiredBody}>{error || 'This preview link has expired or is invalid.'} Generate a new preview from the admin panel.</p>
          <a href="/admin/products" className={styles.back}>← Back to admin</a>
        </div>
      </main>
    );
  }

  const total = product.totalStock ?? product.stockLevel ?? null;
  const outOfStock = total === 0;

  const galleryImages = product.images?.length > 0
    ? product.images
    : product.image
      ? [{ url: product.image, alt: product.name }]
      : [];

  return (
    <>
      <div className={styles.previewBanner} role="banner">
        PREVIEW MODE — not yet published
      </div>
      <main className={styles.page}>
        <ProductSelectionProvider
          defaultColour={product.colours?.[0] ?? ''}
          defaultSize={product.sizes?.length === 1 ? product.sizes[0] : ''}
        >
          <div className={styles.inner}>
            <div className={styles.galleryCol}>
              <ProductGallery images={galleryImages} name={product.name} productId={product._id} />
            </div>
            <div className={styles.infoCol}>
              <span className={styles.statusPill}>{product.status}</span>
              <h1 className={styles.productName}>{product.name}</h1>
              <p className={styles.price}>€{Number(product.price).toFixed(2)}</p>
              <ProductOptions
                colours={product.colours ?? []}
                sizes={product.sizes ?? []}
                productName={product.name}
                productId={product._id}
                price={product.price}
                outOfStock={outOfStock}
                stock={total ?? undefined}
                image={galleryImages[0]?.url}
              />
              {product.description && (
                <details className={styles.accordion} open>
                  <summary className={styles.accordionSummary}>PRODUCT DETAILS</summary>
                  <p className={styles.accordionBody}>{product.description}</p>
                </details>
              )}
            </div>
          </div>

          <StickyBuyBar
            productId={product._id}
            productName={product.name}
            price={product.price}
            outOfStock={outOfStock}
            stock={total ?? undefined}
            image={galleryImages[0]?.url}
            colours={product.colours ?? []}
            sizes={product.sizes ?? []}
          />
        </ProductSelectionProvider>
      </main>
    </>
  );
}
