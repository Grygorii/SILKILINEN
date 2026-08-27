import Link from 'next/link';
import ProductCard, { type ProductCardData } from './ProductCard';
import { categoryHref } from '@/lib/urls';
import type { PageLocale } from '@/lib/i18n';
import styles from './ProductGrid.module.css';

type Product = ProductCardData & {
  category?: string;
  description?: string;
};

/**
 * The shop grid and the category row above it.
 *
 * ── Why this is no longer a client component ──
 *
 * It used to fetch /api/categories itself in an effect and navigate with
 * router.push. Four things were wrong with that, and only one of them looked
 * like a bug:
 *
 *   1. The page ALREADY had the list. shop/page.tsx fetches it to validate the
 *      slug and 404 on a dead one — so a visit to /shop?category=robes made the
 *      same request twice, once on the server and once in the browser.
 *   2. On /shop with no category the server skipped the fetch entirely, so the
 *      row arrived only after hydration: the grid rendered, then a row of
 *      filters appeared above it and pushed everything down.
 *   3. Buttons are not links. The category pages had no crawlable path from the
 *      shop — the one page that should link to all six of them — and a shopper
 *      could not open a category in a new tab.
 *   4. router.push('/shop?category=…') has no locale, so on /de/shop every
 *      filter dropped the visitor into the English shop.
 *
 * Nothing here needs the browser any more, so it renders on the server and
 * ships no JS. The category row itself has since moved to CategoryLinks, so the
 * page can sit it on one line with the sort control instead of stacking two
 * rows of chrome above the first product.
 */
export default function ProductGrid({
  products,
  reachable = true,
  locale = 'en',
}: {
  products: Product[];
  /** false when the product API could not be reached, so an outage is not
   *  reported to the customer as an empty catalogue. */
  reachable?: boolean;
  locale?: PageLocale;
}) {
  return (
    <div>
      {products.length === 0 ? (
        <div className={styles.emptyState}>
          {/* An unreachable API and an empty category look identical once the
              fetch has fallen back to []. Telling a customer "no products yet"
              during an outage is a lie that costs the visit. */}
          <p className={styles.emptyStateText}>
            {reachable === false
              ? 'We couldn’t load the collection just now. Please refresh in a moment.'
              : 'No products in this category yet — check back soon.'}
          </p>
          <Link className={styles.emptyStateBtn} href={categoryHref(null, locale)}>
            Browse all products
          </Link>
        </div>
      ) : (
        <div className={styles.grid}>
          {products.map((product, i) => (
            // First row eager-loads + preloads (the LCP image lives here); the
            // rest lazy-load as the shopper scrolls.
            <ProductCard key={product._id} product={product} priority={i < 4} />
          ))}
        </div>
      )}
    </div>
  );
}
