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

      // Step 2: set a Vercel-domain cookie so Next.js middleware can see it.
      // Railway's cookie is invisible to middleware (cross-domain).
      if (data.token) {
        const sessionRes = await fetch('/api/admin-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: data.token }),
        });
        if (!sessionRes.ok) {
          setError('Session could not be established. Please try again.');
          return;
        }
      } else {
        // Backend hasn't deployed the token-in-body change yet.
        // Fall back: middleware won't see the cookie; layout still validates.
        console.warn('Login response did not include token in body — middleware guard will not work until backend redeploys.');
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
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}
