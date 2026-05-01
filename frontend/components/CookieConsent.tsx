'use client';

import { useState, useEffect } from 'react';
import styles from './CookieConsent.module.css';

const STORAGE_KEY = 'silkilinen_cookie_consent';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  function accept() {
    localStorage.setItem(STORAGE_KEY, 'all');
    setVisible(false);
  }

  function essential() {
    localStorage.setItem(STORAGE_KEY, 'essential');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className={styles.banner} role="dialog" aria-label="Cookie consent">
      <div className={styles.inner}>
        <p className={styles.text}>
          We use cookies to keep your cart between visits and to understand how people find us.
          You can accept all cookies or continue with essential ones only.
        </p>
        <div className={styles.actions}>
          <button className={styles.essentialBtn} onClick={essential}>
            Essential only
          </button>
          <button className={styles.acceptBtn} onClick={accept}>
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
