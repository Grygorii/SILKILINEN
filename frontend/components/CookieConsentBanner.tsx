'use client';

import { useCookieConsent } from '@/context/CookieConsentContext';
import styles from './CookieConsentBanner.module.css';

export default function CookieConsentBanner() {
  const { showBanner, accept, reject } = useCookieConsent();

  if (!showBanner) return null;

  return (
    <div className={styles.banner} role="dialog" aria-label="Cookie consent">
      <p className={styles.text}>
        We use cookies and similar technologies to personalise content, analyse traffic, and show
        relevant ads. See our{' '}
        <a href="/privacy" target="_blank" rel="noopener noreferrer">
          Privacy Policy
        </a>{' '}
        for details.
      </p>
      <div className={styles.buttons}>
        <button className={`${styles.btn} ${styles.btnReject}`} onClick={reject}>
          Reject
        </button>
        <button className={`${styles.btn} ${styles.btnAccept}`} onClick={accept}>
          Accept
        </button>
      </div>
    </div>
  );
}
