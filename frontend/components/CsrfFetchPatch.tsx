'use client';

import { useEffect } from 'react';

// Browser-side global fetch shim that attaches the F8 CSRF header on
// every state-changing request (POST/PUT/PATCH/DELETE). The header's
// presence — not its value — is what blocks cross-origin forgery,
// because browsers refuse to send custom headers cross-origin without
// a CORS preflight that our F9 allowlist rejects.
//
// Patching here means every component's raw fetch() picks it up
// without a 70-file migration. Runs once on mount in the client.

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

declare global {
  interface Window { __csrfFetchPatched?: boolean }
}

export default function CsrfFetchPatch() {
  useEffect(() => {
    if (typeof window === 'undefined' || window.__csrfFetchPatched) return;
    const original = window.fetch.bind(window);
    window.fetch = function patched(input: RequestInfo | URL, init?: RequestInit) {
      const method = (init?.method || (input instanceof Request ? input.method : 'GET') || 'GET').toUpperCase();
      if (SAFE.has(method)) return original(input, init);

      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      if (!headers.has('X-CSRF-Token')) headers.set('X-CSRF-Token', '1');
      return original(input, { ...init, headers });
    };
    window.__csrfFetchPatched = true;
  }, []);
  return null;
}
