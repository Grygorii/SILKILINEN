import type { MetadataRoute } from 'next';

const BASE = 'https://www.silkilinen.com';

// Cap the backend fetch so a slow/cold Railway never makes the whole
// sitemap route hang past Google's fetch timeout. Returns an empty list
// on any failure — Google still gets the static + blog pages, and the
// product URLs reappear on the next ISR revalidation.
const PRODUCT_FETCH_TIMEOUT_MS = 8000;

type SlimProduct = { _id: string; slug?: string; status?: string; updatedAt?: string };

async function getProducts(): Promise<SlimProduct[]> {
  if (!process.env.NEXT_PUBLIC_API_URL) return [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PRODUCT_FETCH_TIMEOUT_MS);
    // ?slim=true returns only id/status/updatedAt — a fraction of the payload,
    // which keeps this fetch well under the timeout as the catalogue grows.
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/products?slim=true`, {
      next: { revalidate: 3600 },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const products = await res.json();
    if (!Array.isArray(products)) return [];
    // Active (incl. sold_out) only — drafts/archived stay out of the sitemap.
    return products.filter((p: SlimProduct) => !p.status || p.status === 'active' || p.status === 'sold_out');
  } catch {
    return [];
  }
}

// Generic slug fetcher for journal/collections/bundles so those indexable
// routes appear in the sitemap instead of relying on internal links alone.
async function getSlugs(path: string): Promise<string[]> {
  if (!process.env.NEXT_PUBLIC_API_URL) return [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PRODUCT_FETCH_TIMEOUT_MS);
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
      next: { revalidate: 3600 },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json();
    const arr = Array.isArray(data) ? data : (data.articles || data.collections || data.bundles || data.items || []);
    return (arr as { slug?: string }[]).map(x => x.slug).filter((s): s is string => Boolean(s));
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE,                        lastModified: new Date(), changeFrequency: 'weekly',  priority: 1 },
    { url: `${BASE}/shop`,              lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
    { url: `${BASE}/about`,             lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/reviews`,           lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE}/contact`,           lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/shipping`,          lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/gift-wrapping`,     lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.4 },
    { url: `${BASE}/size-guide`,        lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/privacy-policy`,    lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE}/terms`,             lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE}/returns`,           lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.4 },
    { url: `${BASE}/journal`,           lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE}/faq`,               lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ];

  const [products, journalSlugs, collectionSlugs, bundleSlugs] = await Promise.all([
    getProducts(),
    getSlugs('/api/journal'),
    getSlugs('/api/collections'),
    getSlugs('/api/bundles'),
  ]);

  const productPages: MetadataRoute.Sitemap = products.map(p => ({
    url: `${BASE}/product/${p.slug || p._id}`,
    // Real per-product lastModified instead of "now" on every entry, so the
    // signal means something to crawlers.
    lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));
  const journalPages: MetadataRoute.Sitemap = journalSlugs.map(slug => ({
    url: `${BASE}/journal/${slug}`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6,
  }));
  const collectionPages: MetadataRoute.Sitemap = collectionSlugs.map(slug => ({
    url: `${BASE}/collections/${slug}`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7,
  }));
  const bundlePages: MetadataRoute.Sitemap = bundleSlugs.map(slug => ({
    url: `${BASE}/bundles/${slug}`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7,
  }));

  return [...staticPages, ...productPages, ...journalPages, ...collectionPages, ...bundlePages];
}
