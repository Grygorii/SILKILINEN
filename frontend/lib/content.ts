export type ContentItem = {
  value: string;
  altText?: string;
  caption?: string;
  type: string;
  label?: string;
  section?: string;
};

export type Content = Record<string, ContentItem>;

const API = process.env.NEXT_PUBLIC_API_URL;

/**
 * CMS content for a section, or `null` when the CMS could not be reached.
 *
 * The null case matters: an empty object used to mean BOTH "the founder set
 * nothing" and "the request timed out", and callers that fall back to hardcoded
 * copy could not tell them apart. That is how a stale "free shipping over €150"
 * default kept surfacing on slow backend responses long after it was removed
 * from the CMS — invisible from the admin panel, because the CMS was never the
 * thing being read. Callers that merely want values can use `?? {}`; callers
 * that would otherwise substitute their own copy must handle null explicitly.
 */
export async function getContent(section?: string): Promise<Content | null> {
  const url = section
    ? `${API}/api/content/${section}`
    : `${API}/api/content`;
  try {
    const res = await fetch(url, { next: { revalidate: 60 }, signal: AbortSignal.timeout(3000) } as RequestInit);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function val(content: Content, key: string, fallback = ''): string {
  return content[key]?.value || fallback;
}
