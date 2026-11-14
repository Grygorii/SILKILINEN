'use client';

import { useEffect, useRef } from 'react';
import { useCookieConsent } from '@/context/CookieConsentContext';
import CookieSettingsModal from './CookieSettingsModal';
import styles from './CookieConsentBanner.module.css';

export default function CookieConsentBanner() {
  const { showBanner, showSettings, accept, openSettings } = useCookieConsent();
  const bannerRef = useRef<HTMLDivElement>(null);

  // Keep the shared bottom clearance equal to the bar that is actually on
  // screen. On a narrow phone the copy can wrap to a different number of
  // lines, so a guessed fixed height can leave the bag button underneath it.
  useEffect(() => {
    const root = document.documentElement;
    if (!showBanner) {
      delete root.dataset.cookieBanner;
      root.style.removeProperty('--cookie-bar-h');
      return;
    }

    root.dataset.cookieBanner = 'true';
    const banner = bannerRef.current;
    const syncHeight = () => {
      const height = banner?.getBoundingClientRect().height ?? 0;
      if (height > 0) root.style.setProperty('--cookie-bar-h', `${Math.ceil(height)}px`);
    };
    syncHeight();

    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(syncHeight);
    if (banner) observer?.observe(banner);
    window.addEventListener('resize', syncHeight);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', syncHeight);
      delete root.dataset.cookieBanner;
      root.style.removeProperty('--cookie-bar-h');
    };
  }, [showBanner]);

  return (
    <>
      {showBanner && (
        <div ref={bannerRef} className={styles.banner} role="region" aria-label="Cookie consent">
          <p className={styles.text}>
            We use cookies to personalise content, measure traffic, and show relevant ads. Read our{' '}
            <a href="/privacy-policy" target="_blank" rel="noopener noreferrer">
              Privacy&nbsp;Policy
            </a>.
          </p>
          <div className={styles.buttons}>
            <button type="button" className={styles.btnAccept} onClick={accept}>
              Accept
            </button>
            <button type="button" className={styles.btnText} onClick={openSettings}>
              Manage
            </button>
          </div>
        </div>
      )}
      {showSettings && <CookieSettingsModal />}
    </>
  );
}
