import Link from 'next/link';
import { safeJsonLd } from '@/lib/safeJsonLd';
import styles from './Breadcrumbs.module.css';

export type Crumb = { label: string; href?: string };

const BASE = 'https://www.silkilinen.com';

// A compact, tappable wayfinding trail (Home / Shop / …). Server-renderable so
// it works in server pages and inside the client SiteBreadcrumbs. The earlier
// per-page "← Back to shop" link was dropped as noise; this gives a quieter,
// standard path back — which browser-back alone doesn't, especially on mobile
// where a product is often opened from a list.
export default function Breadcrumbs({ items, withSchema = false }: { items: Crumb[]; withSchema?: boolean }) {
  if (!items || items.length < 2) return null; // need at least Home + current

  const schema = withSchema ? {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      ...(c.href ? { item: c.href.startsWith('http') ? c.href : `${BASE}${c.href}` } : {}),
    })),
  } : null;

  return (
    <nav aria-label="Breadcrumb" className={styles.nav}>
      {schema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }} />
      )}
      <ol className={styles.list}>
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className={styles.item}>
              {c.href && !last
                ? <Link href={c.href} className={styles.link}>{c.label}</Link>
                : <span className={styles.current} aria-current={last ? 'page' : undefined}>{c.label}</span>}
              {!last && <span className={styles.sep} aria-hidden="true">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
