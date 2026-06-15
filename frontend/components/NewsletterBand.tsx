'use client';

import { useState } from 'react';
import styles from './NewsletterBand.module.css';
import { useSiteSettings } from '@/lib/useSiteSettings';

const API = process.env.NEXT_PUBLIC_API_URL;

export default function NewsletterBand() {
  const { welcomeOfferPercent, welcomeOfferCode } = useSiteSettings();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus('loading');
    try {
      const res = await fetch(`${API}/api/newsletter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      setStatus('success');
      setMessage(data.message || "You're on the list!");
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        {status === 'success' ? (
          <div className={styles.success}>
            <p className={styles.successTitle}>Thank you for joining.</p>
            <p className={styles.successSub}>
              Your welcome gift — <strong>{welcomeOfferPercent}% off</strong> with code <strong>{welcomeOfferCode}</strong> — is on its way.
            </p>
          </div>
        ) : (
          <>
            <div className={styles.text}>
              <h2 className={styles.title}>Join the circle</h2>
              <p className={styles.sub}>
                First access to new silk drops, seasonal pre-orders, and a {welcomeOfferPercent}% welcome offer.
              </p>
            </div>
            <form className={styles.form} onSubmit={handleSubmit}>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Your email address"
                className={styles.input}
                required
                disabled={status === 'loading'}
              />
              <button
                type="submit"
                className={styles.submit}
                disabled={status === 'loading'}
              >
                {status === 'loading' ? 'Joining…' : 'Join'}
              </button>
            </form>
            {status === 'error' && <p className={styles.error}>{message}</p>}
          </>
        )}
      </div>
    </section>
  );
}
