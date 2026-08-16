'use client';

import { useEffect } from 'react';

// Last resort. This catches errors thrown by the ROOT layout itself — the one
// place a segment-level error.tsx cannot help, because the layout that would
// render it is the thing that failed.
//
// It must render its own <html> and <body>: at this point React has unmounted
// the root layout, so nothing else supplies them. That also means no fonts, no
// providers and no globals.css — every value here is a literal by necessity,
// which is why it repeats the palette instead of using tokens.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[root] fatal render error', error.digest ?? '', error.message);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 24px',
          textAlign: 'center',
          background: '#FAF8F4',
          color: '#2A2218',
          fontFamily: 'Georgia, serif',
        }}
      >
        <p
          style={{
            fontSize: 11,
            letterSpacing: '2.5px',
            textTransform: 'uppercase',
            color: '#6B6358',
            marginBottom: 24,
          }}
        >
          SILKILINEN
        </p>
        <h1 style={{ fontSize: 40, fontWeight: 300, margin: '0 0 16px', lineHeight: 1.15 }}>
          We&rsquo;re having a moment.
        </h1>
        <p style={{ fontSize: 16, color: '#6B6358', maxWidth: 440, margin: '0 0 40px', lineHeight: 1.6 }}>
          The site failed to load. Refreshing usually resolves it.
        </p>
        <button
          onClick={reset}
          style={{
            height: 52,
            padding: '0 32px',
            background: '#2A2218',
            color: '#FAF8F4',
            border: 'none',
            borderRadius: 2,
            fontSize: 12,
            letterSpacing: '2.5px',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
