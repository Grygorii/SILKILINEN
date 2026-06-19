import AdminLayout from '@/components/AdminLayout';
import Link from 'next/link';
import styles from './page.module.css';
import SubmitIndexNowButton from '@/components/SubmitIndexNowButton';

const API = process.env.NEXT_PUBLIC_API_URL;
const BASE = 'https://www.silkilinen.com';

type Family =
  | { kind: 'static'; label: string; path: string; section: string; note?: string }
  | { kind: 'dynamic'; label: string; pathPattern: string; section: string; count: number; sampleHref: string; manageHref?: string };

// Hardcoded list of route families. One row per family, not per instance.
// /product/[id] = 1 row showing "Products (N)", not N rows.
const STATIC_PAGES: Omit<Extract<Family, { kind: 'static' }>, 'kind'>[] = [
  { label: 'Home',           path: '/',               section: 'Storefront' },
  { label: 'Shop',           path: '/shop',           section: 'Storefront' },
  { label: 'Journal',        path: '/journal',        section: 'Storefront' },
  { label: 'Reviews',        path: '/reviews',        section: 'Storefront' },
  { label: 'About',          path: '/about',          section: 'Storefront' },
  { label: 'Contact',        path: '/contact',        section: 'Storefront' },
  { label: 'FAQ',            path: '/faq',            section: 'Storefront' },
  { label: 'Size guide',     path: '/size-guide',     section: 'Storefront' },
  { label: 'Shipping',       path: '/shipping',       section: 'Storefront' },
  { label: 'Returns',        path: '/returns',        section: 'Storefront' },
  { label: 'Privacy policy', path: '/privacy-policy', section: 'Legal' },
  { label: 'Terms',          path: '/terms',          section: 'Legal' },
  { label: 'Cookie policy',  path: '/cookie-policy',  section: 'Legal', note: 'Only present if route exists' },
];

async function countAt(path: string, fallback = 0): Promise<number> {
  if (!API) return fallback;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${API}${path}`, { cache: 'no-store', signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return fallback;
    const data = await res.json();
    return Array.isArray(data) ? data.length : (typeof data?.count === 'number' ? data.count : fallback);
  } catch { return fallback; }
}

export default async function PagesOverview() {
  // Pull counts in parallel — each row collapses N instances into 1.
  const [productCount, journalCount, collectionCount, bundleCount] = await Promise.all([
    countAt('/api/products'),
    countAt('/api/journal'),
    countAt('/api/collections'),
    countAt('/api/bundles'),
  ]);

  const dynamicFamilies: Family[] = [
    {
      kind: 'dynamic',
      label: 'Products',
      pathPattern: '/product/[id]',
      section: 'Storefront',
      count: productCount,
      sampleHref: '/shop',
      manageHref: '/admin/products',
    },
    {
      kind: 'dynamic',
      label: 'Journal articles',
      pathPattern: '/journal/[slug]',
      section: 'Storefront',
      count: journalCount,
      sampleHref: '/journal',
      manageHref: '/admin/journal',
    },
    {
      kind: 'dynamic',
      label: 'Collections',
      pathPattern: '/collections/[slug]',
      section: 'Storefront',
      count: collectionCount,
      sampleHref: '/shop',
      manageHref: '/admin/collections',
    },
    {
      kind: 'dynamic',
      label: 'Bundles',
      pathPattern: '/bundles/[slug]',
      section: 'Storefront',
      count: bundleCount,
      sampleHref: '/shop',
      manageHref: '/admin/bundles',
    },
  ];

  const staticFamilies: Family[] = STATIC_PAGES.map(p => ({ kind: 'static', ...p }));
  const all: Family[] = [...dynamicFamilies, ...staticFamilies];

  // Group by section for the rendered table.
  const sections = Array.from(new Set(all.map(f => f.section)));

  const totalUrls = staticFamilies.length + dynamicFamilies.reduce((s, f) => s + (f.kind === 'dynamic' ? f.count : 0), 0);

  return (
    <AdminLayout active="pages">
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>Pages</h1>
          <p className={styles.sub}>
            Every public route on the storefront. Dynamic routes (products, articles) appear once with a count
            instead of one row per instance — open the matching admin section to manage individual items.
          </p>
          <div className={styles.statRow}>
            <span><strong>{totalUrls}</strong> public URLs</span>
            <span>·</span>
            <a href={`${BASE}/sitemap.xml`} target="_blank" rel="noopener noreferrer">Sitemap.xml</a>
            <span>·</span>
            <a href={`${BASE}/robots.txt`} target="_blank" rel="noopener noreferrer">Robots.txt</a>
            <span>·</span>
            <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer">Search Console</a>
          </div>
          <SubmitIndexNowButton />
        </header>

        {sections.map(section => (
          <section key={section} className={styles.section}>
            <h2 className={styles.sectionTitle}>{section}</h2>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Page</th>
                  <th>Path</th>
                  <th>Type</th>
                  <th>Manage</th>
                </tr>
              </thead>
              <tbody>
                {all.filter(f => f.section === section).map(f => {
                  if (f.kind === 'dynamic') {
                    return (
                      <tr key={f.pathPattern}>
                        <td>
                          <span className={styles.label}>{f.label}</span>
                          <span className={styles.count}>{f.count}</span>
                        </td>
                        <td><code>{f.pathPattern}</code></td>
                        <td><span className={styles.tagDyn}>dynamic</span></td>
                        <td className={styles.actions}>
                          <a href={`${BASE}${f.sampleHref}`} target="_blank" rel="noopener noreferrer">View ↗</a>
                          {f.manageHref && <Link href={f.manageHref}>Manage →</Link>}
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={f.path}>
                      <td>
                        <span className={styles.label}>{f.label}</span>
                        {f.note && <span className={styles.note}>{f.note}</span>}
                      </td>
                      <td><code>{f.path}</code></td>
                      <td><span className={styles.tagStatic}>static</span></td>
                      <td className={styles.actions}>
                        <a href={`${BASE}${f.path}`} target="_blank" rel="noopener noreferrer">View ↗</a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))}

        <footer className={styles.footer}>
          <h3>Notes</h3>
          <ul>
            <li>Admin pages (under /admin) are intentionally not listed — they're not public and shouldn't be indexed.</li>
            <li>The /blog route was retired and now 301-redirects to /journal.</li>
            <li>Counts come from the backend API at page load and aren't cached. Drafts and archived products are excluded from the storefront-visible count.</li>
          </ul>
        </footer>
      </div>
    </AdminLayout>
  );
}
