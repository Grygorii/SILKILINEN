import Link from 'next/link';
import { categoryHref } from '@/lib/urls';
import type { PageLocale } from '@/lib/i18n';
import styles from './CategoryLinks.module.css';

export type GridCategory = { slug: string; label: string; count: number };

/**
 * The category row above a shop listing.
 *
 * Lifted out of ProductGrid so the PAGE can put it on the same line as the sort
 * control. Stacked, the two rows cost about 124px of a phone screen before the
 * first product — a shopper looking for silk was reading two rows of controls
 * and a heading before she saw a single garment.
 *
 * Anchors, not buttons, and built through categoryHref: these are the only
 * crawlable links from the shop to the six category pages, and they must carry
 * the locale or every filter on /de/shop lands in the English shop.
 */
export default function CategoryLinks({
  categories,
  current = 'all',
  locale = 'en',
}: {
  categories: GridCategory[];
  current?: string;
  locale?: PageLocale;
}) {
  if (categories.length === 0) return null;

  return (
    <nav className={styles.row} aria-label="Product categories">
      <Link
        href={categoryHref(null, locale)}
        className={`${styles.link} ${current === 'all' ? styles.active : ''}`}
        aria-current={current === 'all' ? 'page' : undefined}
      >
        All
      </Link>
      {categories.map(cat => (
        <Link
          key={cat.slug}
          href={categoryHref(cat.slug, locale)}
          className={`${styles.link} ${current === cat.slug ? styles.active : ''}`}
          aria-current={current === cat.slug ? 'page' : undefined}
        >
          {cat.label.toUpperCase()}
        </Link>
      ))}
    </nav>
  );
}
