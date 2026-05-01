'use client';

import { useEffect, useState } from 'react';
import styles from './NewsletterPopup.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;
const DISMISSED_KEY = 'silkilinen_newsletter_dismissed';

export default function NewsletterPopup() {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return;
    const timer = setTimeout(() => setVisible(true), 30_000);
    return () => clearTimeout(timer);
  }, []);

  function dismiss() {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, '1');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    try {
      const res = await fetch(`${API}/api/newsletter/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error('Failed');
      setStatus('success');
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      setStatus('error');
      setErrorMsg('Something went wrong — please try again.');
    }
  }

  if (!visible) return null;

  return (
    <div className={styles.backdrop} onClick={dismiss}>
      <div className={styles.popup} onClick={e => e.stopPropagation()}>
        <button className={styles.close} onClick={dismiss} aria-label="Close">✕</button>

        {status === 'success' ? (
          <div className={styles.successState}>
            <p className={styles.successIcon}>✓</p>
            <h2>You&apos;re in.</h2>
            <p>Check your inbox — your 10% discount code is on its way.</p>
          </div>
        ) : (
          <>
            <p className={styles.eyebrow}>Join the list</p>
            <h2 className={styles.title}>10% off your<br />first order</h2>
            <p className={styles.sub}>
              Subscribe for exclusive offers, new arrivals, and care tips for your silk and linen pieces.
            </p>
            <form onSubmit={handleSubmit} className={styles.form}>
              <input
                type="email"
                placeholder="Your email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className={styles.input}
              />
              <button type="submit" className={styles.btn} disabled={status === 'loading'}>
                {status === 'loading' ? 'Sending…' : 'Get 10% off'}
              </button>
            </form>
            {status === 'error' && <p className={styles.error}>{errorMsg}</p>}
            <p className={styles.disclaimer}>No spam, ever. Unsubscribe any time.</p>
          </>
        )}
      </div>
    </div>
  );
}
