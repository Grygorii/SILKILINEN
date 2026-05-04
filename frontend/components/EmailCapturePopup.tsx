'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import styles from './EmailCapturePopup.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;
const STORAGE_KEY = 'slk_nl_dismissed';
const SUPPRESS_DAYS = 30;
const BLOCKED_PATHS = ['/admin', '/account', '/checkout', '/success'];

export default function EmailCapturePopup() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  const isBlocked = BLOCKED_PATHS.some(p => pathname.startsWith(p));

  const shouldShow = useCallback(() => {
    if (isBlocked) return false;
    if (typeof window === 'undefined') return false;
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) return true;
    const age = Date.now() - Number(dismissed);
    return age > SUPPRESS_DAYS * 24 * 60 * 60 * 1000;
  }, [isBlocked]);

  useEffect(() => {
    if (!shouldShow()) return;

    let shown = false;
    function show() {
      if (shown) return;
      shown = true;
      setVisible(true);
    }

    // Trigger 1: 30s timer
    const timer = setTimeout(show, 30_000);

    // Trigger 2: 50% scroll
    function onScroll() {
      const pct = window.scrollY / (document.body.scrollHeight - window.innerHeight);
      if (pct >= 0.5) show();
    }

    // Trigger 3: exit intent (mouse leaves top of viewport)
    function onMouseOut(e: MouseEvent) {
      if (e.clientY <= 0) show();
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('mouseleave', onMouseOut);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('mouseleave', onMouseOut);
    };
  }, [shouldShow]);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setVisible(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus('loading');
    try {
      await fetch(`${API}/api/newsletter/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'popup' }),
      });
      setStatus('success');
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
      setTimeout(() => setVisible(false), 3000);
    } catch {
      // Still mark as dismissed to avoid annoying the customer
      setStatus('success');
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
      setTimeout(() => setVisible(false), 3000);
    }
  }

  if (!visible) return null;

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) dismiss(); }}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Newsletter signup">
        <button className={styles.close} onClick={dismiss} aria-label="Close">✕</button>

        {status === 'success' ? (
          <div className={styles.success}>
            <p className={styles.successIcon}>✓</p>
            <p className={styles.successTitle}>Check your inbox</p>
            <p className={styles.successSub}>Your 10% off code is on its way.</p>
          </div>
        ) : (
          <>
            <p className={styles.eyebrow}>PURE SILK, PURE COMFORT</p>
            <h2 className={styles.title}>10% off your first order</h2>
            <p className={styles.body}>
              Sign up for slow style notes, new collections,<br />
              and a code for your first piece.
            </p>
            <form className={styles.form} onSubmit={handleSubmit}>
              <input
                type="email"
                className={styles.input}
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                disabled={status === 'loading'}
                autoFocus
              />
              <button type="submit" className={styles.btn} disabled={status === 'loading'}>
                {status === 'loading' ? 'Joining…' : 'GET 10% OFF'}
              </button>
            </form>
            <p className={styles.small}>No spam. Unsubscribe anytime.</p>
          </>
        )}
      </div>
    </div>
  );
}
