'use client';

import { useCookieConsent } from '@/context/CookieConsentContext';
import CookieSettingsModal from './CookieSettingsModal';
import styles from './CookieConsentBanner.module.css';

export default function CookieConsentBanner() {
  const { showBanner, showSettings, accept, openSettings } = useCookieConsent();

  return (
    <>
      {showBanner && (
        <div className={styles.banner} role="region" aria-label="Cookie consent">
          <p className={styles.text}>
            We use cookies and similar technologies to personalise content, analyse traffic, and show
            relevant ads. See our{' '}
            <a href="/privacy-policy" target="_blank" rel="noopener noreferrer">
              Privacy Policy
            </a>{' '}
            for details.
          </p>
          <div className={styles.buttons}>
            <button className={`${styles.btn} ${styles.btnAccept}`} onClick={accept}>
              ACCEPT ALL
            </button>
            <button className={`${styles.btn} ${styles.btnSettings}`} onClick={openSettings}>
              COOKIE SETTINGS
            </button>
          </div>
        </div>
      )}
      {showSettings && <CookieSettingsModal />}
    </>
  );
}
