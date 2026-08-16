'use client';

import { useEffect } from 'react';
import Link from 'next/link';

// Admin error boundary. Separate from the storefront's because the audience is
// different: the founder needs the error DIGEST to be visible, since that is the
// string that joins this screen to the server log. A customer never needs it.
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[admin] render error', error.digest ?? '', error.message);
  }, [error]);

  return (
    <main style={{ padding: 48, maxWidth: 640 }}>
      <h1 style={{ fontSize: 20, color: 'var(--admin-ink)', margin: '0 0 8px' }}>
        This screen failed to render.
      </h1>
      <p style={{ fontSize: 14, color: 'var(--admin-ink-muted)', margin: '0 0 20px', lineHeight: 1.6 }}>
        Nothing was saved or changed by the failure. The rest of the admin is unaffected.
      </p>
      {error.digest && (
        <p
          style={{
            fontSize: 12,
            fontFamily: 'monospace',
            color: 'var(--admin-ink-muted)',
            background: 'var(--admin-bg)',
            border: '1px solid var(--admin-line)',
            padding: '8px 12px',
            margin: '0 0 20px',
          }}
        >
          digest: {error.digest}
        </p>
      )}
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={reset}
          style={{
            padding: '10px 22px',
            background: 'var(--admin-ink)',
            color: 'var(--admin-surface)',
            border: 'none',
            fontSize: 12,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Try again
        </button>
        <Link
          href="/admin"
          style={{
            padding: '10px 22px',
            border: '1px solid var(--admin-line)',
            color: 'var(--admin-ink)',
            fontSize: 12,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            textDecoration: 'none',
          }}
        >
          Dashboard
        </Link>
      </div>
    </main>
  );
}
