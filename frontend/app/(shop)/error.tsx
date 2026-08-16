'use client';

import { useEffect } from 'react';
import Link from 'next/link';

// Storefront error boundary. There was none anywhere in the app, so any runtime
// error in a client component fell through to Next's default screen — a bare
// "Application error: a client-side exception has occurred" on a luxury shop,
// with no way back except the browser's back button. That is a lost sale and a
// broken brand impression at the same time.
//
// Scoped to (shop) so the header, footer and cart survive: the customer keeps
// their cart and their navigation, and only the failed section is replaced.
//
// Deliberately NOT a retry loop. `reset()` re-renders the segment once; if the
// cause is persistent the customer gets the same screen rather than a spinner
// that never resolves, and the routes out are always visible.
export default function ShopError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-side errors arrive with only a digest — the message is withheld by
    // Next in production. Logging it client-side is what makes the digest
    // joinable to the server log when a customer reports a broken page.
    console.error('[storefront] render error', error.digest ?? '', error.message);
  }, [error]);

  return (
    <main
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 24px',
        textAlign: 'center',
      }}
    >
      <p
        style={{
          fontFamily: 'Jost, sans-serif',
          fontSize: 11,
          letterSpacing: '2.5px',
          textTransform: 'uppercase',
          color: 'var(--color-ink-muted)',
          marginBottom: 24,
        }}
      >
        Something went wrong
      </p>
      <h1
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 'clamp(32px, 5vw, 48px)',
          fontWeight: 300,
          lineHeight: 1.15,
          color: 'var(--color-ink)',
          margin: '0 0 16px',
          maxWidth: 640,
        }}
      >
        This part of the shop didn&rsquo;t load.
      </h1>
      <p
        style={{
          fontFamily: 'Jost, sans-serif',
          fontSize: 15,
          fontWeight: 300,
          lineHeight: 1.6,
          color: 'var(--color-ink-muted)',
          maxWidth: 460,
          margin: '0 0 40px',
        }}
      >
        Your cart is safe. Try again, or carry on browsing — everything else is working.
      </p>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={reset}
          style={{
            height: 52,
            padding: '0 32px',
            background: 'var(--color-ink)',
            color: 'var(--color-bg)',
            border: '1px solid var(--color-ink)',
            borderRadius: 2,
            fontFamily: 'Jost, sans-serif',
            fontSize: 12,
            letterSpacing: '2.5px',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
        <Link
          href="/shop"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 52,
            padding: '0 32px',
            background: 'transparent',
            color: 'var(--color-ink)',
            border: '1px solid var(--color-ink)',
            borderRadius: 2,
            fontFamily: 'Jost, sans-serif',
            fontSize: 12,
            letterSpacing: '2.5px',
            textTransform: 'uppercase',
            textDecoration: 'none',
          }}
        >
          Continue shopping
        </Link>
      </div>
    </main>
  );
}
