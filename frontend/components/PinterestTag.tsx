'use client';

import Script from 'next/script';
import { useEffect } from 'react';
import { useCookieConsent } from '@/context/CookieConsentContext';

const TAG_ID = process.env.NEXT_PUBLIC_PINTEREST_TAG_ID;

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
          pintrk('load', '${TAG_ID}', {em: ''});
          pintrk('page');
        `,
      }}
    />
  );
}
