import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Page not found',
  description: 'The page you were looking for could not be found.',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 24px',
        textAlign: 'center',
        background: 'var(--color-bg, #FAF8F4)',
      }}
    >
      <p
        style={{
          fontFamily: 'Jost, sans-serif',
          fontSize: 11,
          letterSpacing: '2.5px',
          textTransform: 'uppercase',
          color: 'var(--color-ink-muted, #8A8278)',
          marginBottom: 24,
        }}
      >
        404 — page not found
      </p>
      <h1
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 'clamp(36px, 6vw, 56px)',
          fontWeight: 300,
          lineHeight: 1.15,
          color: 'var(--color-ink, #2A2218)',
          margin: '0 0 16px',
          maxWidth: 640,
        }}
      >
        This page seems to have slipped away.
      </h1>
      <p
        style={{
          fontFamily: 'Jost, sans-serif',
          fontSize: 15,
          fontWeight: 300,
          lineHeight: 1.6,
          color: 'var(--color-ink-muted, #8A8278)',
          maxWidth: 480,
          margin: '0 0 40px',
        }}
      >
        It may have been moved, renamed, or perhaps never existed. The collection is just a click away.
      </p>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link
          href="/shop"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 52,
            padding: '0 32px',
            background: 'var(--color-ink, #2A2218)',
            color: 'var(--color-bg, #FAF8F4)',
            border: '1px solid var(--color-ink, #2A2218)',
            borderRadius: 2,
            fontFamily: 'Jost, sans-serif',
            fontSize: 12,
            letterSpacing: '2.5px',
            textTransform: 'uppercase',
            textDecoration: 'none',
          }}
        >
          Shop the collection
        </Link>
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 52,
            padding: '0 32px',
            background: 'transparent',
            color: 'var(--color-ink, #2A2218)',
            border: '1px solid var(--color-ink, #2A2218)',
            borderRadius: 2,
            fontFamily: 'Jost, sans-serif',
            fontSize: 12,
            letterSpacing: '2.5px',
            textTransform: 'uppercase',
            textDecoration: 'none',
          }}
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
