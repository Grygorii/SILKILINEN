'use client';

import Script from 'next/script';
import { useEffect } from 'react';
import { useCookieConsent } from '@/context/CookieConsentContext';

const RAW_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
// `String(undefined)` is the literal "undefined" which is truthy — that
// was leaking into the script as fbq('init', 'undefined') and tripping
// Meta's "Invalid PixelID: null" console error on every page load.
// Treat the string "undefined"/"null" as missing.
const PIXEL_ID = RAW_PIXEL_ID && RAW_PIXEL_ID !== 'undefined' && RAW_PIXEL_ID !== 'null'
  ? RAW_PIXEL_ID
  : '';

declare global {
  interface Window {
    fbq: (...args: unknown[]) => void;
    _fbq: unknown;
  }
}

export function trackFbEvent(event: string, params?: Record<string, unknown>, eventId?: string) {
  if (typeof window === 'undefined' || !window.fbq) return;
  if (eventId) {
    window.fbq('track', event, params || {}, { eventID: eventId });
  } else {
    window.fbq('track', event, params || {});
  }
}

export default function MetaPixel() {
  const { consent, preferences } = useCookieConsent();
  const allowed = consent === 'accepted' || (consent === 'customised' && preferences?.marketing === true);

  useEffect(() => {
    if (allowed && typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'PageView');
    }
  }, [allowed]);

  if (!PIXEL_ID || !allowed) return null;
  // Meta pixel IDs are numeric; strip anything else to defeat script
  // injection if the env var ever contains quotes or HTML.
  const safePixelId = PIXEL_ID.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safePixelId) return null;

  return (
    <Script
      id="meta-pixel"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${safePixelId}');
          fbq('track', 'PageView');
        `,
      }}
    />
  );
}
