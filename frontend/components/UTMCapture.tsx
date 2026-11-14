'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { captureAcquisition } from '@/lib/acquisition';
import { allowsAnalytics } from '@/lib/analyticsConsent';
import { isBrowserExcludedFromAnalytics, subscribeToBrowserAnalyticsExclusion } from '@/lib/analyticsExclude';
import { useCookieConsent } from '@/context/CookieConsentContext';
export default function UTMCapture() {
  const { consent, preferences } = useCookieConsent();
  const allowed = allowsAnalytics(consent, preferences);
  const browserExcluded = useSyncExternalStore(subscribeToBrowserAnalyticsExclusion, isBrowserExcludedFromAnalytics, () => false);

  useEffect(() => {
    if (!allowed || browserExcluded) return;
    try { captureAcquisition(window.sessionStorage, { search: window.location.search, pathname: window.location.pathname, hostname: window.location.hostname, referrer: document.referrer }); }
    catch { /* Blocked storage is not a shopping error. */ }
  }, [allowed, browserExcluded]);
  return null;
}
