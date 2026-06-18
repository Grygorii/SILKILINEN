'use client';

import Script from 'next/script';
import { useEffect } from 'react';
import { useCookieConsent } from '@/context/CookieConsentContext';

// Defaults to the founder's own confirmed Pinterest tag (2612639946416) so it
// works zero-config; NEXT_PUBLIC_PINTEREST_TAG_ID (Vercel) still overrides.
const RAW_TAG_ID = process.env.NEXT_PUBLIC_PINTEREST_TAG_ID || '2612639946416';
// `String(undefined)` is the literal "undefined" which is truthy — that
// was leaking into the script as pintrk('load', 'undefined', ...) and
// causing the ct.pinterest.com/v3/... 400s on every page load.
// Treat the string "undefined"/"null" as missing.
const TAG_ID = RAW_TAG_ID && RAW_TAG_ID !== 'undefined' && RAW_TAG_ID !== 'null'
  ? RAW_TAG_ID
  : '';

declare global {
  interface Window {
    pintrk: ((...args: unknown[]) => void) & { queue?: unknown[]; version?: string };
  }
}

export function trackPinEvent(event: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !window.pintrk) return;
  window.pintrk('track', event, params || {});
}

export default function PinterestTag() {
  const { consent, preferences } = useCookieConsent();
  const allowed = consent === 'accepted' || (consent === 'customised' && preferences?.marketing === true);

  useEffect(() => {
    if (allowed && typeof window !== 'undefined' && window.pintrk) {
      window.pintrk('track', 'pagevisit');
    }
  }, [allowed]);

  if (!TAG_ID || !allowed) return null;
  // Pinterest tag IDs are numeric; strip anything else to defeat script
  // injection if the env var is ever set to something hostile.
  const safeTagId = TAG_ID.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeTagId) return null;

  return (
    <Script
      id="pinterest-tag"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          !function(e){if(!window.pintrk){window.pintrk=function(){window.pintrk.queue.push(
          Array.prototype.slice.call(arguments))};var n=window.pintrk;n.queue=[],n.version="3.0";
          var t=document.createElement("script");t.async=!0,t.src=e;
          var r=document.getElementsByTagName("script")[0];r.parentNode.insertBefore(t,r)}}
          ("https://s.pinimg.com/ct/core.js");
          pintrk('load', '${safeTagId}', {em: ''});
          pintrk('page');
        `,
      }}
    />
  );
}
