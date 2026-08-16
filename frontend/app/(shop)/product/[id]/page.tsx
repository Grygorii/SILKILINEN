import type { Metadata } from 'next';
import { apiJson } from '@/lib/apiFetch';
import { permanentRedirect, notFound } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';
import ProductOptions from '@/components/ProductOptions';
import StickyBuyBar from '@/components/StickyBuyBar';
import ProductGallery from '@/components/ProductGallery';
import { safeJsonLd } from '@/lib/safeJsonLd';
import PageTracker from '@/components/PageTracker';
import CrossSell from '@/components/CrossSell';
import RecentlyViewed from '@/components/RecentlyViewed';
import ProductReviews from '@/components/ProductReviews';
import Price from '@/components/Price';
import ProductViewTracker from '@/components/ProductViewTracker';
import Breadcrumbs from '@/components/Breadcrumbs';
import { ProductSelectionProvider } from '@/components/ProductSelectionContext';
import { AccordionGroup, AccordionItem, AccordionSubLabel } from '@/components/ui/Accordion';
import { shippingDetailsFor, merchantReturnPolicy } from '@/lib/shippingSchema';
import { clampMeta } from '@/lib/clampMeta';
import { getLocale, apiLocaleQuery, hreflangAlternates, localeUrl, localeHref, type PageLocale } from '@/lib/i18n-server';
import { productHref, productPath } from '@/lib/urls';
import { brand } from '@/lib/brand';

const API = process.env.NEXT_PUBLIC_API_URL;

async function getProduct(id: string, locale: PageLocale = 'en') {
  const q = apiLocaleQuery(locale);
  // Timed out: this runs during render, so an unresponsive API would hold the
  // route open rather than letting notFound() take over cleanly.
  // Untyped like the original: this page reads a wide, evolving set of product
  // fields, and narrowing it here would only move the guesswork into a type
  // that has to be kept in step by hand.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await apiJson<any>(`${API}/api/products/${id}${q ? `?${q}` : ''}`, { next: { revalidate: 120 } });
  return data && !data.error ? data : null;
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
  const locale = await getLocale();
  const product = await getProduct(id, locale);
  // Never let a missing product be indexed, even for the brief window before
  // notFound() renders.
  if (!product) return { title: 'Product not found', robots: { index: false, follow: true } };

  // Title template in app/layout.tsx appends " | Silkilinen", so the
  // per-page title shouldn't include the brand. metaTitle from the admin
  // editor is honoured as an absolute override when set.
  // A well-written metaTitle is self-contained (≤70 chars), so use it as an
  // ABSOLUTE title — appending the layout's " | Silkilinen" suffix to it pushed
  // long titles past 60 chars (the "title too long" audit warning). The bare
  // name still gets the template suffix.
  const titleStr = product.metaTitle || product.name;
  const title = product.metaTitle ? { absolute: product.metaTitle } : product.name;
  const description = clampMeta(product.metaDescription
    || (product.description ? product.description : `Shop ${product.name} at Silkilinen. Pure silk and linen intimates, shipped worldwide from Donegal.`));
  const canonicalPath = productPath({ slug: product.slug, _id: id });
  const url = localeUrl(locale, canonicalPath);
  const primaryImage = product.images?.find((i: { isPrimary: boolean }) => i.isPrimary);
  const image = primaryImage?.url || product.images?.[0]?.url || product.image || `${brand.url}/og-default.jpg`;

  return {
    title,
    description,
    openGraph: {
      title: titleStr,
      description,
      url,
      images: [{ url: image, width: 1200, height: 630, alt: product.altText || product.name }],
      siteName: 'Silkilinen',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: titleStr,
      description,
      images: [image],
    },
    alternates: { canonical: url, languages: hreflangAlternates(canonicalPath) },
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

// The description is stored with blank-line paragraph breaks (the admin editor
// is a textarea), but JSX collapses newlines — so multi-paragraph copy rendered
// as one run-on block. That, not a missing animation, is why the story read as a
// wall of text. Render the founder's own pacing instead of inventing new pacing.
function toParagraphs(text?: string): string[] {
  return String(text || '')
    .split(/\n\s*\n/)
    .map(p => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
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
  const locale = await getLocale();
  const product = await getProduct(id, locale);
  // Canonicalise to the slug URL: if reached via the ObjectId or an old slug,
  // 308-redirect to the current slug so there's exactly one indexable URL
  // (keeping the locale prefix so /de/product/<id> → /de/product/<slug>).
  if (product && product.slug && id !== product.slug) {
    permanentRedirect(productHref({ slug: product.slug }, locale));
  }
  // Reviews specifically for this product; null when no approved reviews
  // exist yet (skip the aggregateRating/review JSON-LD fields when null
  // — Google rejects schemas with zero-count or missing values).
  const productReviews = product ? await getProductReviews(product._id) : null;
  // Live shipping tiers (same source checkout uses) for the Offer's
  // shippingDetails — these used to be a drifting copy in the frontend.
  const shippingDetails = product ? await shippingDetailsFor(Number(product.price) || 0) : [];

  // A real 404, not a page that says "not found" with a 200.
  //
  // Rendering this inline was a SOFT 404: Google receives a successful
  // response, indexes it as a legitimate page, and the shop accumulates
  // indexed URLs whose only content is an apology. notFound() returns a true
  // 404 and renders app/not-found.tsx, which is already branded and offers a
  // way back into the collection.
  if (!product) notFound();

  const total = product.totalStock ?? product.stockLevel ?? null;
  const outOfStock = total === 0;
  const materialSub = getMaterialSub(product.materialComposition);
  // Design-system v1: manual isNewArrival flag set in admin. Fall back to
  // the 30-day-since-createdAt heuristic for products that pre-date the
  // field so the badge doesn't suddenly disappear from existing recent
  // products. Accept the legacy `isNew` value too for products migrated
  // from the original bad-field-name shipping.
  // Same rule as ProductCard: the manual flag, and nothing else.
  //
  // This used to fall back to "created within 30 days" via Date.now(), which
  // was wrong twice over. It disagreed with the card — a product with no flag
  // showed NEW on its own page and not in the grid it sits in — and it made the
  // render impure: the page is cached with revalidate 120, so the badge froze
  // at whatever Date.now() said when the snapshot was taken and then lied for
  // as long as the cache held.
  const showNew = Boolean(product.isNewArrival ?? product.isNew);

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
    // Google recommends multiple images for Product rich results — emit the
    // whole gallery, not just the first shot.
    image: galleryImages.length ? galleryImages.map((g: { url?: string }) => g.url).filter(Boolean) : undefined,
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
      url: localeUrl(locale, productPath({ slug: product.slug, _id: id })),
      // GSC merchant-listing audit flagged these two as missing. Both are
      // policy-level (not per-product) so we always emit them.
      shippingDetails: shippingDetails,
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
      { '@type': 'ListItem', position: 1, name: 'Home', item: localeUrl(locale, '/') },
      { '@type': 'ListItem', position: 2, name: 'Shop', item: localeUrl(locale, '/shop') },
      ...(product.category
        ? [{ '@type': 'ListItem', position: 3, name: String(product.category).replace(/-/g, ' '), item: localeUrl(locale, `/shop?category=${product.category}`) }]
        : []),
      { '@type': 'ListItem', position: product.category ? 4 : 3, name: product.name, item: localeUrl(locale, productPath({ slug: product.slug, _id: id })) },
    ],
  };

  // Visible trail mirroring the JSON-LD above (Home / Shop / Category / Product).
  const categoryLabel = product.category
    ? String(product.category).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : null;
  const crumbs = [
    { label: 'Home', href: '/' },
    { label: 'Shop', href: '/shop' },
    ...(product.category ? [{ label: categoryLabel as string, href: `/shop?category=${product.category}` }] : []),
    { label: product.name },
  ];

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
        <ProductViewTracker id={product._id} name={product.name} price={product.price} image={galleryImages[0]?.url} category={product.category} />
        <PageTracker page="product" productId={product._id} />

        <Breadcrumbs items={crumbs} />


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
                    {product.colorVariants?.map((v: { productId: string; colorName: string; slug?: string }) => (
                      <Link
                        key={v.productId}
                        // Canonical by construction — the API now serves each
                        // sibling's slug, and productHref always prefers it.
                        href={productHref({ slug: v.slug, _id: v.productId }, locale)}
                        className={styles.cubeLink}
                      >
                        {v.colorName}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <p className={styles.price}>
                <Price eur={Number(product.price)} className={product.compareAtPrice && product.compareAtPrice > product.price ? styles.priceSale : ''} />
                {product.compareAtPrice && product.compareAtPrice > product.price && (
                  <Price eur={Number(product.compareAtPrice)} className={styles.priceCompare} />
                )}
              </p>

              <StockBadge product={product} />

              <ProductOptions
                // Which sizes actually have stock. Without this the picker
                // offered every size, so a customer could choose one that was
                // gone, add it, and only be refused at checkout — the last
                // place you want to tell someone no. The collections route
                // already exposed this for its "shop the set" pickers; the
                // product page did not.
                availableSizes={
                  Array.isArray(product.variants) && product.variants.length
                    ? [...new Set<string>(
                        product.variants
                          .filter((v: { size?: string; stockLevel?: number }) => (v.stockLevel ?? 0) > 0 && v.size)
                          .map((v: { size?: string }) => String(v.size)),
                      )]
                    // No variant data at all means stock is untracked for this
                    // piece, not that everything is sold out.
                    : null
                }
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
                      {toParagraphs(product.description).map((para, i) => (
                        <p key={i} className={styles.descPara}>{para}</p>
                      ))}
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
                          <p className={styles.mommeNote}>Momme (mm) measures silk weight — the higher the momme, the more substantial, durable and opaque the silk.</p>
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

      <ProductReviews productId={product._id} productName={product.name} />

      <CrossSell productId={id} />
      <RecentlyViewed excludeId={id} />
    </>
  );
}
