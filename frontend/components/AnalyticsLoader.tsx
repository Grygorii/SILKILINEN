'use client';

import Script from 'next/script';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { useCookieConsent } from '@/context/CookieConsentContext';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID || 'G-XZG6XTZ3S8';
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID || 'wkxxtbufn3';

export default function AnalyticsLoader() {
  const { consent, preferences } = useCookieConsent();
  const allowed = consent === 'accepted' || (consent === 'customised' && preferences?.analytics === true);

  if (!allowed) return null;

  return (
    <>
      <Analytics />
      <SpeedInsights />
      {GA_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}');
          `}</Script>
        </>
      )}
      {CLARITY_ID && (
        <Script id="clarity-init" strategy="afterInteractive">{`
          (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "${CLARITY_ID}");
        `}</Script>
      )}
    </>
  );
}
