'use client';
import { useEffect } from 'react';
import { captureAcquisition } from '@/lib/acquisition';
import { allowsAnalytics } from '@/lib/analyticsConsent';
import { useCookieConsent } from '@/context/CookieConsentContext';
export default function UTMCapture() {
  const { consent, preferences } = useCookieConsent();
  const allowed = allowsAnalytics(consent, preferences);

  useEffect(() => {
    if (!allowed) return;
    try { captureAcquisition(window.sessionStorage, { search: window.location.search, pathname: window.location.pathname, hostname: window.location.hostname, referrer: document.referrer }); }
    catch { /* Blocked storage is not a shopping error. */ }
  }, [allowed]);
  return null;
}
