const API = process.env.NEXT_PUBLIC_API_URL;

export type PageMeta = { metaTitle?: string; metaDescription?: string };

// Server helper: the editable SEO override for a static page path, or null.
// Used in pages' generateMetadata so the Rebuild SEO pipeline / admin can set a
// page's meta without a code change. Falls back silently if unreachable.
export async function getPageMeta(path: string): Promise<PageMeta | null> {
  try {
    const res = await fetch(`${API}/api/page-seo`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const map = await res.json();
    return (map && map[path]) || null;
  } catch {
    return null;
  }
}
