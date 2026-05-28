'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If a valid Vercel-domain session already exists, skip the login form.
  // We check via GET /api/admin-session (same domain, readable server-side)
  // rather than calling Railway directly — Railway's cookie is cross-domain
  // and the login page can't see it.
  useEffect(() => {
    fetch('/api/admin-session')
      .then(r => { if (r.ok) window.location.replace('/admin'); })
      .catch(() => {});
  }, []);

  async function handleLogin(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Step 1: authenticate with Railway.
      // This sets a Railway-domain httpOnly cookie used by client-side
      // fetch() calls to the Railway API (credentials: 'include').
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      // Step 2: exchange the single-use bootstrap nonce for a
      // Vercel-domain cookie so Next.js middleware can see the session.
      // The JWT itself is exchanged server-to-server inside
      // /api/admin-session and never enters the browser.
      if (data.bootstrap) {
        const sessionRes = await fetch('/api/admin-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bootstrap: data.bootstrap }),
        });
        if (!sessionRes.ok) {
          setError('Session could not be established. Please try again.');
          return;
        }
      } else {
        // Backend on an older deploy that still returns data.token.
        // Fall back so login keeps working during the rollout window.
        console.warn('Login response did not include bootstrap nonce — backend may need a redeploy.');
      }

      // Step 3: full page reload so middleware evaluates the new cookie.
      window.location.href = '/admin';
    } catch {
      setError('Something went wrong. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1>SILKILINEN</h1>
        <p>Admin Panel</p>
        <form onSubmit={handleLogin} className={styles.form}>
          {error && <p className={styles.error}>{error}</p>}
          <label style={{ display: 'block', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6, textAlign: 'left' }}>
            Email
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{ display: 'block', marginTop: 4, width: '100%' }}
            />
          </label>
          <label style={{ display: 'block', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6, textAlign: 'left' }}>
            Password
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{ display: 'block', marginTop: 4, width: '100%' }}
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}
