'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function UnsubscribeContent() {
  const params = useSearchParams();
  const status = params.get('status');

  return (
    <main style={{ maxWidth: 480, margin: '80px auto', padding: '0 24px', textAlign: 'center', fontFamily: 'Georgia, serif' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Newsletter Preferences</h1>

      {status === 'success' && (
        <p style={{ color: '#4a7c59' }}>You&apos;ve been unsubscribed. We&apos;re sorry to see you go.</p>
      )}
      {status === 'invalid' && (
        <p style={{ color: '#c0392b' }}>This unsubscribe link is invalid or has already been used.</p>
      )}
      {status === 'error' && (
        <p style={{ color: '#c0392b' }}>Something went wrong. Please contact us at hello@silkilinen.com.</p>
      )}
      {!status && (
        <p>Click the unsubscribe link in your email to confirm.</p>
      )}

      <a href="/" style={{ display: 'inline-block', marginTop: '2rem', color: '#1a1916', textDecoration: 'underline' }}>
        Return to SILKILINEN
      </a>
    </main>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense>
      <UnsubscribeContent />
    </Suspense>
  );
}
