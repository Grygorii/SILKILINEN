'use client';

import { useCookieConsent } from '@/context/CookieConsentContext';

export default function CookiePreferencesLink() {
  const { openBanner } = useCookieConsent();

  return (
    <button
      onClick={openBanner}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit', textDecoration: 'none', display: 'block' }}
    >
      Cookie preferences
    </button>
  );
}
