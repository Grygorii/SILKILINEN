'use client';

import { useCookieConsent } from '@/context/CookieConsentContext';

export default function CookiePreferencesLink() {
  const { openSettings } = useCookieConsent();

  return (
    <button
      onClick={openSettings}
      style={{
        background: 'none', border: 'none', padding: 0, minHeight: 44,
        cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit',
        textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
      }}
    >
      Cookie preferences
    </button>
  );
}
