'use client';

import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';

const API = process.env.NEXT_PUBLIC_API_URL;

/**
 * Top-of-checkout shortcut for returning customers. Same Google flow as
 * /account/sign-in but inline — on success, the parent's refresh() pulls
 * the Customer record and the checkout form auto-prefills email + name
 * + saved shipping address from it.
 *
 * Hidden when GOOGLE_CLIENT_ID is unset so a missing env var never
 * shows a broken UI.
 */
export default function GoogleCheckoutSignIn({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) return null;

  async function handleCredential(credential: string) {
    setError('');
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/customers/google`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Google sign-in failed');
      }
      await onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        marginBottom: 24,
        padding: 16,
        border: '1px solid var(--color-line, #E8E2D6)',
        borderRadius: 'var(--radius-control, 2px)',
        background: 'var(--color-surface, #F5F0E8)',
      }}
    >
      <p
        style={{
          margin: '0 0 12px',
          fontFamily: 'Jost, sans-serif',
          fontSize: 12,
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          color: 'var(--color-ink-muted, #8A8278)',
        }}
      >
        Returning customer? Faster with Google
      </p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', minHeight: 44 }}>
        <GoogleLogin
          onSuccess={r => r.credential && handleCredential(r.credential)}
          onError={() => setError('Google sign-in failed')}
          theme="outline"
          size="large"
          text="continue_with"
          width="280"
        />
      </div>
      {busy && (
        <p style={{ marginTop: 8, fontSize: 12, color: 'var(--color-ink-muted, #8A8278)' }}>
          Signing in…
        </p>
      )}
      {error && (
        <p style={{ marginTop: 8, fontSize: 12, color: '#c9572a' }}>{error}</p>
      )}
    </div>
  );
}
