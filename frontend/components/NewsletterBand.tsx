'use client';

import { useId, useState } from 'react';
import styles from './NewsletterBand.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type NewsletterBandProps = {
  welcomeOfferPercent: number;
  privacyHref: string;
};

export default function NewsletterBand({ welcomeOfferPercent, privacyHref }: NewsletterBandProps) {
  const consentId = useId();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || status === 'loading') return;
    setStatus('loading');
    try {
      const res = await fetch(`${API}/api/newsletter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'We couldn’t subscribe you. Please try again.');
      }
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  return (
    <section aria-label="Newsletter sign-up">
      <div role="status">
        {status === 'success' && (
          <h2 className={styles.title}>Thank you for joining.</h2>
        )}
      </div>
      {status !== 'success' && (
        <>
          <h2 className={styles.title}>Join the circle</h2>
          <p className={styles.description}>
            First access to new silk pieces, seasonal pre-orders and a {welcomeOfferPercent}% welcome offer.
          </p>
          <form className={styles.form} method="post" onSubmit={handleSubmit}>
            <input
              type="email"
              name="email"
              autoComplete="email"
              aria-label="Email address"
              aria-describedby={consentId}
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="Your email address"
              className={styles.input}
              required
              readOnly={status === 'loading'}
            />
            <button type="submit" className={styles.submit} disabled={status === 'loading'}>
              {status === 'loading' ? 'Subscribing…' : 'Subscribe'}
            </button>
          </form>
          <p id={consentId} className={styles.consent}>
            By subscribing, you agree to receive our newsletter. <a href={privacyHref}>Privacy policy</a>
          </p>
          {status === 'error' && <p className={styles.error} role="alert">{message}</p>}
        </>
      )}
    </section>
  );
}
