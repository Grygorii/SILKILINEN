'use client';

import { useState } from 'react';
import { useCookieConsent } from '@/context/CookieConsentContext';
import styles from './CookieSettingsModal.module.css';

export default function CookieSettingsModal() {
  const { reject, savePreferences, preferences, closeSettings } = useCookieConsent();
  const [functional, setFunctional] = useState(preferences?.functional ?? false);
  const [analytics, setAnalytics] = useState(preferences?.analytics ?? false);
  const [marketing, setMarketing] = useState(preferences?.marketing ?? false);

  return (
    <div className={styles.overlay} onClick={closeSettings}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Cookie preferences"
        onClick={e => e.stopPropagation()}
      >
        <h2 className={styles.title}>COOKIE PREFERENCES</h2>

        <div className={styles.categories}>
          <Category
            name="Necessary cookies"
            description="Required for the website to function — checkout, login, basic UX."
            checked={true}
            disabled
          />
          <Category
            name="Functional cookies"
            description="Remember your preferences (region, currency, recently viewed)."
            checked={functional}
            onChange={() => setFunctional(f => !f)}
          />
          <Category
            name="Analytics cookies"
            description="Help us understand how visitors use the site."
            checked={analytics}
            onChange={() => setAnalytics(a => !a)}
          />
          <Category
            name="Marketing cookies"
            description="Used to show relevant ads on other sites you visit."
            checked={marketing}
            onChange={() => setMarketing(m => !m)}
          />
        </div>

        <div className={styles.actions}>
          <button className={`${styles.btn} ${styles.btnReject}`} onClick={reject}>
            REJECT ALL
          </button>
          <button
            className={`${styles.btn} ${styles.btnSave}`}
            onClick={() => savePreferences({ functional, analytics, marketing })}
          >
            SAVE PREFERENCES
          </button>
        </div>
      </div>
    </div>
  );
}

function Category({
  name,
  description,
  checked,
  disabled,
  onChange,
}: {
  name: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: () => void;
}) {
  return (
    <div className={styles.category}>
      <div className={styles.categoryText}>
        <p className={styles.categoryName}>{name}</p>
        <p className={styles.categoryDesc}>{description}</p>
      </div>
      <button
        className={`${styles.toggle} ${checked ? styles.toggleOn : ''}`}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={onChange}
      >
        <span className={styles.toggleThumb} />
      </button>
    </div>
  );
}
