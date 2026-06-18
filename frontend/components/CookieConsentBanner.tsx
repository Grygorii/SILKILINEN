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
            We use cookies to personalise content, measure traffic, and show relevant ads. Read our{' '}
            <a href="/privacy-policy" target="_blank" rel="noopener noreferrer">
              Privacy&nbsp;Policy
            </a>.
          </p>
          <div className={styles.buttons}>
            <button className={styles.btnAccept} onClick={accept}>
              Accept
            </button>
            <button className={styles.btnText} onClick={openSettings}>
              Manage
            </button>
          </div>
        </div>
      )}
      {showSettings && <CookieSettingsModal />}
    </>
  );
}
