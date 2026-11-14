'use client';

import { useCookieConsent } from '@/context/CookieConsentContext';

export default function CookiePreferencesLink({ className }: { className: string }) {
  const { openSettings } = useCookieConsent();

  return (
    <button type="button" className={className} onClick={openSettings}>
      Cookie preferences
    </button>
  );
}
