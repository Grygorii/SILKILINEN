import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './page.module.css';
import ProductOptions from '@/components/ProductOptions';
import StickyBuyBar from '@/components/StickyBuyBar';
import ProductGallery from '@/components/ProductGallery';
import { safeJsonLd } from '@/lib/safeJsonLd';
import PageTracker from '@/components/PageTracker';
import CrossSell from '@/components/CrossSell';
import RecentlyViewed from '@/components/RecentlyViewed';
import ProductViewTracker from '@/components/ProductViewTracker';
import { ProductSelectionProvider } from '@/components/ProductSelectionContext';
import { AccordionGroup, AccordionItem, AccordionSubLabel } from '@/components/ui/Accordion';
import { shippingDetailsFor, merchantReturnPolicy } from '@/lib/shippingSchema';

const API = process.env.NEXT_PUBLIC_API_URL;

async function getProduct(id: string) {
  try {
    const res = await fetch(`${API}/api/products/${id}`, { next: { revalidate: 120 } });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error) return null;
    return data;
  } catch {
    return null;
  }
}

type ProductReviewSummary = { average: number; count: number };
type ProductReview = { _id: string; reviewer: string; title?: string; message?: string; starRating: number; dateReviewed: string };

async function getProductReviews(productId: string): Promise<{ summary: ProductReviewSummary; recent: ProductReview[] } | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const [summaryRes, listRes] = await Promise.all([
      fetch(`${API}/api/reviews/summary?productId=${productId}`, { signal: ctrl.signal, next: { revalidate: 600 } }),
      fetch(`${API}/api/reviews?productId=${productId}&limit=6`, { signal: ctrl.signal, next: { revalidate: 600 } }),
    ]);
    clearTimeout(t);
    if (!summaryRes.ok) return null;
    const summary = await summaryRes.json();
    const listData = listRes.ok ? await listRes.json() : { reviews: [] };
    const recent = Array.isArray(listData) ? listData : (listData.reviews || []);
    if (!summary || typeof summary.count !== 'number' || summary.count === 0) return null;
    return { summary, recent };
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return { title: 'Product Not Found' };

  // Title template in app/layout.tsx appends " | Silkilinen", so the
  // per-page title shouldn't include the brand. metaTitle from the admin
  // editor is honoured as an absolute override when set.
  const title = product.metaTitle || product.name;
  const description = product.metaDescription
    || (product.description ? product.description.slice(0, 155) : `Shop ${product.name} at Silkilinen. Pure silk and linen intimates, shipped worldwide from Donegal.`);
  const url = `https://www.silkilinen.com/product/${id}`;
  const primaryImage = product.images?.find((i: { isPrimary: boolean }) => i.isPrimary);
  const image = primaryImage?.url || product.images?.[0]?.url || product.image || 'https://www.silkilinen.com/og-default.jpg';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      images: [{ url: image, width: 1200, height: 630, alt: product.altText || product.name }],
      siteName: 'Silkilinen',
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

// Lowercase to match the ProductCard caption voice — keeps the brand
// language consistent between the shop grid card and the PDP subtitle.
function getMaterialSub(mat?: string): string {
  if (!mat) return '';
  const m = mat.toLowerCase();
  if (m.includes('mulberry silk')) return 'in mulberry silk';
  if (m.includes('silk satin')) return 'in silk satin';
  if (m.includes('silk') && m.includes('linen')) return 'in silk & linen';
  if (m.includes('silk')) return 'in pure silk';
  if (m.includes('linen')) return 'in pure linen';
  return '';
}

function getStorySnippet(description?: string): { text: string; truncated: boolean } | null {
  if (!description?.trim()) return null;
  const d = description.trim();
  if (d.length < 20) return null;
  if (d.length <= 180) return { text: d, truncated: false };
  // Try to break at a sentence boundary
  const cutoff = d.lastIndexOf('. ', 180);
  if (cutoff > 60) return { text: d.slice(0, cutoff + 1), truncated: true };
  return { text: d.slice(0, 180) + '…', truncated: true };
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
  // Reviews specifically for this product; null when no approved reviews
  // exist yet (skip the aggregateRating/review JSON-LD fields when null
  // — Google rejects schemas with zero-count or missing values).
  const productReviews = product ? await getProductReviews(id) : null;

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
  // Design-system v1: manual isNewArrival flag set in admin. Fall back to
  // the 30-day-since-createdAt heuristic for products that pre-date the
  // field so the badge doesn't suddenly disappear from existing recent
  // products. Accept the legacy `isNew` value too for products migrated
  // from the original bad-field-name shipping.
  const manualFlag = product.isNewArrival ?? product.isNew;
  const showNew = typeof manualFlag === 'boolean'
    ? manualFlag
    : (product.createdAt
        ? Date.now() - new Date(product.createdAt).getTime() < 30 * 86_400_000
        : false);

  const galleryImages = product.images?.length > 0
    ? product.images
    : product.image
      ? [{ url: product.image, alt: product.name }]
      : [];

  const snippet = getStorySnippet(product.description);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || '',
    image: galleryImages[0]?.url || undefined,
    brand: { '@type': 'Brand', name: 'SILKILINEN' },
    // Apparel attributes — also published authoritatively in /feed/google.xml,
    // but emitting the valid schema.org props here helps free listings and
    // rich results. Each is omitted when the product lacks the data.
    ...(product.colorName || product.colours?.[0] ? { color: product.colorName || product.colours[0] } : {}),
    ...(Array.isArray(product.sizes) && product.sizes.length ? { size: product.sizes } : {}),
    ...(product.materialComposition ? { material: product.materialComposition } : {}),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'EUR',
      price: Number(product.price).toFixed(2),
      availability: outOfStock
        ? 'https://schema.org/OutOfStock'
        : 'https://schema.org/InStock',
      url: `https://www.silkilinen.com/product/${id}`,
      // GSC merchant-listing audit flagged these two as missing. Both are
      // policy-level (not per-product) so we always emit them.
      shippingDetails: shippingDetailsFor(Number(product.price) || 0),
      hasMerchantReturnPolicy: merchantReturnPolicy,
    },
    // Per-product aggregateRating + review — emitted only when there are
    // approved reviews linked to this productId. When count===0 the
    // fields are omitted (Google rejects empty/zero schemas) and the
    // GSC "missing aggregateRating" warning persists until the first
    // real review lands. Brand-level rating is still on Organization
    // in layout.tsx for the rest of the storefront.
    ...(productReviews
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: productReviews.summary.average,
            reviewCount: productReviews.summary.count,
            bestRating: 5,
            worstRating: 1,
          },
          review: productReviews.recent.slice(0, 5).map(r => ({
            '@type': 'Review',
            reviewRating: { '@type': 'Rating', ratingValue: r.starRating, bestRating: 5, worstRating: 1 },
            author: { '@type': 'Person', name: r.reviewer },
            datePublished: r.dateReviewed,
            reviewBody: r.message || r.title || '',
          })),
        }
      : {}),
  };

  // Breadcrumb JSON-LD — surfaces a structured trail in Google results
  // (Home > Shop > Category > Product) instead of the raw URL.
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.silkilinen.com' },
      { '@type': 'ListItem', position: 2, name: 'Shop', item: 'https://www.silkilinen.com/shop' },
      ...(product.category
        ? [{ '@type': 'ListItem', position: 3, name: String(product.category).replace(/-/g, ' '), item: `https://www.silkilinen.com/shop?category=${product.category}` }]
        : []),
      { '@type': 'ListItem', position: product.category ? 4 : 3, name: product.name, item: `https://www.silkilinen.com/product/${id}` },
    ],
  };

  return (
    <>
      <main className={styles.page}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }}
        />
        <ProductViewTracker id={product._id} name={product.name} price={product.price} image={galleryImages[0]?.url} />
        <PageTracker page="product" productId={product._id} />

        <ProductSelectionProvider
          defaultColour={product.colours?.[0] ?? ''}
          defaultSize={product.sizes?.length === 1 ? product.sizes[0] : ''}
        >
          <div className={styles.inner}>
            {/* Gallery */}
            <div className={styles.galleryCol}>
              <ProductGallery
                images={galleryImages}
                name={product.name}
                productId={product._id}
                video={product.productVideo ?? null}
              />
            </div>

            {/* Info — sticky on desktop, static on mobile */}
            <div className={styles.infoCol}>
              {/* Design-system v1: NEW badge is a warm-beige uppercase pill,
                  sits as a label rather than an afterthought. The previous
                  "← Back to shop" link was removed — browser back is enough,
                  the link added noise above the title. */}
              {showNew && <span className={styles.newTag}>NEW</span>}
              <h1 className={styles.productName}>{product.name}</h1>
              {materialSub && <p className={styles.materialSub}>{materialSub}</p>}
              {product.fitNote && <p className={styles.fitNote}>{product.fitNote}</p>}

              {/* Colour variant cubes — links to sibling colour products */}
              {(product.colorName || (product.colorVariants && product.colorVariants.length > 0)) && (
                <div className={styles.colourCubes}>
                  <p className={styles.colourLabel}>COLOUR</p>
                  <div className={styles.cubeRow}>
                    <span className={styles.cubeActive}>
                      {product.colorName || product.colours?.[0] || 'One Colour'}
                    </span>
                    {product.colorVariants?.map((v: { productId: string; colorName: string }) => (
                      <Link
                        key={v.productId}
                        href={`/product/${v.productId}`}
                        className={styles.cubeLink}
                      >
                        {v.colorName}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

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
                colourHexMap={
                  // Build a name→hex map from the product's own colorName/Hex
                  // (single-colour case) plus any sibling colorVariants that
                  // happen to carry a hex. Missing colours fall through to
                  // the warm-beige placeholder in the swatch component.
                  (() => {
                    const map: Record<string, string> = {};
                    if (product.colorName && product.colorHex) {
                      map[String(product.colorName).toLowerCase()] = product.colorHex;
                    }
                    return map;
                  })()
                }
                sizes={product.sizes ?? []}
                productName={product.name}
                productId={product._id}
                price={product.price}
                outOfStock={outOfStock}
                stock={total ?? undefined}
                image={galleryImages[0]?.url}
              />

              {/* Story sentence — below Add to Bag so CTA is always above fold */}
              {snippet && (
                <p className={styles.storySentence}>
                  {snippet.text}
                  {snippet.truncated && (
                    <>{' '}<a href="#product-details" className={styles.readMore}>Read more</a></>
                  )}
                </p>
              )}

              {/* Accordions — design-system v1. Only Product Details open by
                  default; the others reveal on click. 320ms ease. */}
              <div id="product-details" className={styles.accordions}>
                <AccordionGroup>
                  {product.description && (
                    <AccordionItem label="Product details" defaultOpen>
                      {product.description}
                    </AccordionItem>
                  )}
                  {(product.materialComposition || product.careInstructions || product.momme) && (
                    <AccordionItem label="Material & care">
                      {product.materialComposition && (
                        <>
                          <AccordionSubLabel>Composition</AccordionSubLabel>
                          <p>{product.materialComposition}</p>
                        </>
                      )}
                      {product.momme && (
                        <>
                          <AccordionSubLabel>Weight</AccordionSubLabel>
                          <p>{product.momme} momme</p>
                        </>
                      )}
                      {product.careInstructions && (
                        <>
                          <AccordionSubLabel>Care</AccordionSubLabel>
                          <p>{product.careInstructions}</p>
                        </>
                      )}
                    </AccordionItem>
                  )}
                  <AccordionItem label="Delivery & returns">
                    We ship from Donegal, Ireland worldwide. Standard delivery 5–10 business days. Express shipping available at checkout. Returns accepted within 14 days of delivery for unworn items in their original condition.
                  </AccordionItem>
                  <AccordionItem label="Gift packaging">
                    Every order is wrapped in our signature tissue-lined box with ribbon — ready for gifting. Add a personal note in the order notes at checkout.
                  </AccordionItem>
                </AccordionGroup>
              </div>
            </div>
          </div>

          {/* Mobile sticky add-to-bag — same component the preview page uses,
              now on the live PDP so the buy action is always reachable on a
              phone. Hidden on desktop via its own CSS. */}
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

      <CrossSell productId={id} />
      <RecentlyViewed excludeId={id} />
    </>
  );
}
