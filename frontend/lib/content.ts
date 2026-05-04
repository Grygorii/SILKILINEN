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

export async function getContent(section?: string): Promise<Content> {
  const url = section
    ? `${API}/api/content/${section}`
    : `${API}/api/content`;
  try {
    const res = await fetch(url, { next: { revalidate: 60 }, signal: AbortSignal.timeout(3000) } as RequestInit);
    if (!res.ok) return {};
    return res.json();
  } catch {
    return {};
  }
}

export function val(content: Content, key: string, fallback = ''): string {
  return content[key]?.value || fallback;
}
