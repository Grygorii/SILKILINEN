// One way to call the API from a server component.
//
// Every storefront page fetched with a bare `await fetch(...)` and no timeout.
// These run during render, so a slow or hanging Railway did not degrade the
// page — it held the render open until Vercel's own function timeout and then
// failed the whole route. A shop that renders without its product grid is a bad
// afternoon; a shop that returns nothing at all is a lost customer.
//
// lib/content.ts already had a 3s timeout, so the pattern existed and simply
// was not applied anywhere else. This is that pattern with one owner.
//
// Deliberately returns `null` rather than throwing: callers already handle an
// empty result (an empty grid, a missing hero), and a page that renders
// partially beats a page that 500s.

const DEFAULT_TIMEOUT_MS = 4000;

type Options = RequestInit & {
  /** Next.js cache directives, e.g. { revalidate: 60 }. */
  next?: { revalidate?: number; tags?: string[] };
  timeoutMs?: number;
};

/**
 * Fetch JSON from the API with a timeout. Returns null on any failure —
 * timeout, network error, non-2xx, or unparseable body.
 */
export async function apiJson<T>(url: string, options: Options = {}): Promise<T | null> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...init } = options;
  try {
    const res = await fetch(url, {
      ...init,
      // AbortSignal.timeout covers a server that accepts the connection and
      // then never answers, which a plain network error would not catch.
      signal: AbortSignal.timeout(timeoutMs),
    } as RequestInit);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Same, for endpoints that return a list — null and non-arrays become []. */
export async function apiList<T>(url: string, options: Options = {}): Promise<T[]> {
  const data = await apiJson<T[]>(url, options);
  return Array.isArray(data) ? data : [];
}
