import type { MetadataRoute } from 'next';

const BASE = 'https://silkilinen.com';

// Cap the backend fetch so a slow/cold Railway never makes the whole
// sitemap route hang past Google's fetch timeout. Returns an empty list
// on any failure — Google still gets the static + blog pages, and the
// product URLs reappear on the next ISR revalidation.
const PRODUCT_FETCH_TIMEOUT_MS = 8000;

async function getProductIds(): Promise<string[]> {
  if (!process.env.NEXT_PUBLIC_API_URL) return [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PRODUCT_FETCH_TIMEOUT_MS);
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/products`, {
      next: { revalidate: 3600 },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const products = await res.json();
    if (!Array.isArray(products)) return [];
    // Filter to active products only — drafts shouldn't be in the
    // public sitemap, and archived ones should drop off too.
    return products
      .filter((p: { _id: string; status?: string }) => !p.status || p.status === 'active' || p.status === 'sold_out')
      .map((p: { _id: string }) => p._id);
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
    { url: `${BASE}/size-guide`,        lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/privacy-policy`,    lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE}/terms`,             lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE}/returns`,           lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.4 },
    { url: `${BASE}/journal`,           lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE}/faq`,               lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ];

  const ids = await getProductIds();
  const productPages: MetadataRoute.Sitemap = ids.map(id => ({
    url: `${BASE}/product/${id}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...staticPages, ...productPages];
}
