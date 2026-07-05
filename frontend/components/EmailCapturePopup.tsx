'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Button from './ui/Button';
import styles from './EmailCapturePopup.module.css';
import { useSiteSettings } from '@/lib/useSiteSettings';

const API = process.env.NEXT_PUBLIC_API_URL;
const STORAGE_KEY = 'slk_nl_dismissed';
const SUPPRESS_DAYS = 30;
const BLOCKED_PATHS = ['/admin', '/account', '/checkout', '/success'];

export default function EmailCapturePopup() {
  const { welcomeOfferPercent } = useSiteSettings();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const modalRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  const isBlocked = BLOCKED_PATHS.some(p => pathname.startsWith(p));

  const shouldShow = useCallback(() => {
    if (isBlocked) return false;
    if (typeof window === 'undefined') return false;
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) return true;
    const age = Date.now() - Number(dismissed);
    return age > SUPPRESS_DAYS * 24 * 60 * 60 * 1000;
  }, [isBlocked]);

  const dismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setVisible(false);
  }, []);

  useEffect(() => {
    if (!shouldShow()) return;

    let shown = false;
    function show() {
      if (shown) return;
      shown = true;
      setVisible(true);
    }

    const timer = setTimeout(show, 30_000);
    function onScroll() {
      const pct = window.scrollY / (document.body.scrollHeight - window.innerHeight);
      if (pct >= 0.5) show();
    }
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

  // While open: Escape to close, trap Tab within the modal, restore focus on close.
  useEffect(() => {
    if (!visible) return;
    prevFocusRef.current = document.activeElement as HTMLElement;
    const modal = modalRef.current;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { dismiss(); return; }
      if (e.key === 'Tab' && modal) {
        const f = modal.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])');
        if (f.length === 0) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prevFocusRef.current?.focus?.();
    };
  }, [visible, dismiss]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus('loading');
    try {
      const res = await fetch(`${API}/api/newsletter/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'popup' }),
      });
      if (!res.ok) throw new Error('subscribe failed');
      // Only claim success on a real 2xx.
      setStatus('success');
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
      setTimeout(() => setVisible(false), 3000);
    } catch {
      setStatus('error');
    }
  }

  if (!visible) return null;

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) dismiss(); }}>
      <div ref={modalRef} className={styles.modal} role="dialog" aria-modal="true" aria-label="Newsletter signup">
        <button className={styles.close} onClick={dismiss} aria-label="Close">✕</button>

        {status === 'success' ? (
          <div className={styles.success}>
            <p className={styles.successIcon}>✓</p>
            <p className={styles.successTitle}>Check your inbox</p>
            <p className={styles.successSub}>Your {welcomeOfferPercent}% off code is on its way.</p>
          </div>
        ) : (
          <>
            <p className={styles.eyebrow}>Pure silk &amp; linen · an Irish brand</p>
            <h2 className={styles.title}>{welcomeOfferPercent}% off your first order</h2>
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
                onChange={e => { setEmail(e.target.value); if (status === 'error') setStatus('idle'); }}
                required
                disabled={status === 'loading'}
                autoFocus
              />
              <Button
                type="submit"
                variant={status === 'loading' ? 'disabled' : 'primary'}
              >
                {status === 'loading' ? 'JOINING…' : `GET ${welcomeOfferPercent}% OFF`}
              </Button>
            </form>
            {status === 'error' && (
              <p className={styles.small} style={{ color: 'var(--color-danger)' }}>
                Something went wrong — please try again.
              </p>
            )}
            <p className={styles.small}>No spam. Unsubscribe anytime.</p>
          </>
        )}
      </div>
    </div>
  );
}
