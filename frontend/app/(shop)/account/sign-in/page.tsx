'use client';

import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useCustomer } from '@/context/CustomerContext';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

export default function SignInPage() {
  const { refresh } = useCustomer();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/customers/request-magic-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle(credential: string) {
    setError('');
    try {
      const res = await fetch(`${API}/api/customers/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ credential }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await refresh();
      router.push('/account');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <h1 className={styles.title}>Sign in</h1>
        <p className={styles.sub}>To your SILKILINEN account</p>

        {sent ? (
          <div className={styles.sentBox}>
            <p className={styles.sentIcon}>✉</p>
            <p className={styles.sentTitle}>Check your email</p>
            <p className={styles.sentText}>
              We sent a sign-in link to <strong>{email}</strong>.<br />
              It expires in 15 minutes.
            </p>
          </div>
        ) : (
          <>
            <form onSubmit={handleMagicLink} className={styles.form}>
              <div className={styles.field}>
                <label htmlFor="email">Email address</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                />
              </div>
              {error && <p className={styles.error}>{error}</p>}
              <button className={styles.btn} disabled={loading}>
                {loading ? 'Sending…' : 'Send sign-in link'}
              </button>
            </form>

            <div className={styles.divider}><span>or</span></div>

            <div className={styles.googleWrap}>
              <GoogleLogin
                onSuccess={r => r.credential && handleGoogle(r.credential)}
                onError={() => setError('Google sign-in failed')}
                theme="outline"
                size="large"
                width="100%"
                text="continue_with"
              />
            </div>
          </>
        )}

        <p className={styles.hint}>
          No password needed — we use secure magic links and Google Sign-In.
        </p>
      </div>
    </div>
  );
}
