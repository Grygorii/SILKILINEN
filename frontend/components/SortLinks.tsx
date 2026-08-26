import Link from 'next/link';
import { shopPath, type ShopParams } from '@/lib/urls';
import { localeHref } from '@/lib/i18n';
import type { PageLocale } from '@/lib/i18n';
import styles from './SortLinks.module.css';

/**
 * Sort order for a shop listing.
 *
 * Links, not a <select>. Three reasons, in order of how much they cost:
 *   - Each order is a real URL, so it can be shared, opened in a new tab and
 *     restored by the back button. A select needs JavaScript to do any of that.
 *   - The grid above it is a server component now; a select would drag the
 *     whole listing back into the client bundle for four options.
 *   - Every one of these URLs canonicalises to the unsorted page (shop/page.tsx
 *     builds its canonical from category/q/new and ignores sort), so they add
 *     no duplicate content to the index.
 *
 * The keys must match the whitelist in backend/utils/productSort.js — that file
 * owns which orders exist, this one owns what they are called on screen.
 */
const OPTIONS: { key: string; label: string }[] = [
  { key: 'featured', label: 'Featured' },
  { key: 'newest', label: 'Newest' },
  { key: 'price-asc', label: 'Price ↑' },
  { key: 'price-desc', label: 'Price ↓' },
];

export default function SortLinks({
  current = 'featured',
  params = {},
  locale = 'en',
}: {
  current?: string;
  /** The view being sorted. Carried through so sorting never drops the filter. */
  params?: ShopParams;
  locale?: PageLocale;
}) {
  const active = OPTIONS.some(o => o.key === current) ? current : 'featured';

  return (
    <nav className={styles.root} aria-label="Sort products">
      <span className={styles.label}>Sort</span>
      {OPTIONS.map(o => (
        <Link
          key={o.key}
          href={localeHref(locale, shopPath({ ...params, sort: o.key }))}
          className={`${styles.link} ${o.key === active ? styles.active : ''}`}
          aria-current={o.key === active ? 'true' : undefined}
        >
          {o.label}
        </Link>
      ))}
    </nav>
  );
}
