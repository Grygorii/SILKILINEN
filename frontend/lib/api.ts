// Centralized fetch wrapper. Use this for every call to the backend so:
//   - the base URL is set in one place (NEXT_PUBLIC_API_URL)
//   - credentials: 'include' is always on (cookies for auth)
//   - the F8 CSRF header is attached automatically on writes
//   - non-2xx responses become rejections with the parsed body
//
// Same-origin calls to Next.js route handlers (e.g. /api/admin-session)
// should pass `local: true` to skip the base URL.

const BASE = process.env.NEXT_PUBLIC_API_URL || '';

type ApiInit = Omit<RequestInit, 'body'> & {
  body?: unknown;
  local?: boolean;
};

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, data: unknown, message: string) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

function buildUrl(path: string, local?: boolean): string {
  if (local || path.startsWith('http')) return path;
  return `${BASE}${path}`;
}

function shouldSendCsrf(method: string): boolean {
  const m = method.toUpperCase();
  return m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS';
}

export async function apiFetch<T = unknown>(path: string, init: ApiInit = {}): Promise<T> {
  const method = (init.method || 'GET').toUpperCase();
  const headers = new Headers(init.headers);

  let body: BodyInit | undefined;
  if (init.body !== undefined && init.body !== null) {
    if (typeof init.body === 'string' || init.body instanceof FormData || init.body instanceof Blob) {
      body = init.body as BodyInit;
    } else {
      if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
      body = JSON.stringify(init.body);
    }
  }

  if (shouldSendCsrf(method) && !headers.has('X-CSRF-Token')) {
    // Value is arbitrary; the header's presence is what defeats CSRF.
    headers.set('X-CSRF-Token', '1');
  }

  const res = await fetch(buildUrl(path, init.local), {
    ...init,
    method,
    headers,
    credentials: init.credentials ?? 'include',
    body,
  });

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload: unknown = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (!res.ok) {
    const message = (isJson && payload && typeof payload === 'object' && 'error' in payload)
      ? String((payload as { error: unknown }).error)
      : `Request failed with ${res.status}`;
    throw new ApiError(res.status, payload, message);
  }

  return payload as T;
}

export const api = {
  get:    <T = unknown>(p: string, init?: ApiInit) => apiFetch<T>(p, { ...init, method: 'GET' }),
  post:   <T = unknown>(p: string, body?: unknown, init?: ApiInit) => apiFetch<T>(p, { ...init, method: 'POST', body }),
  put:    <T = unknown>(p: string, body?: unknown, init?: ApiInit) => apiFetch<T>(p, { ...init, method: 'PUT', body }),
  patch:  <T = unknown>(p: string, body?: unknown, init?: ApiInit) => apiFetch<T>(p, { ...init, method: 'PATCH', body }),
  delete: <T = unknown>(p: string, init?: ApiInit) => apiFetch<T>(p, { ...init, method: 'DELETE' }),
};

/**
 * Download the response body as a file. Used by admin exports (GDPR JSON,
 * customer CSV) — they're POSTs (not GETs) so they're covered by the CSRF
 * middleware, but the browser still has to write the response to a blob
 * + trigger an a[download] click manually.
 */
export async function downloadBlob(path: string, filename: string, init: ApiInit = {}): Promise<void> {
  const { body: _body, local, headers: initHeaders, credentials, method: initMethod, ...rest } = init;
  void _body; // downloadBlob never sends a body; drop it from the spread so TS doesn't see the BodyInit-incompatible `unknown` type
  const method = (initMethod || 'POST').toUpperCase();
  const headers = new Headers(initHeaders);
  if (shouldSendCsrf(method) && !headers.has('X-CSRF-Token')) {
    headers.set('X-CSRF-Token', '1');
  }
  const res = await fetch(buildUrl(path, local), {
    ...rest,
    method,
    headers,
    credentials: credentials ?? 'include',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ApiError(res.status, body, `Download failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
