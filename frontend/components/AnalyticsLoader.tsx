'use client';

import Script from 'next/script';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { useCookieConsent } from '@/context/CookieConsentContext';

// GA4 stays env-only: G-XZG6XTZ3S8 ownership is unconfirmed, so a blank env var
// means the script doesn't mount and visitor data never flows to a stranger's
// account. Set NEXT_PUBLIC_GA_ID in Vercel to your own GA4 property to enable it.
// Clarity defaults to wkxxtbufn3 — the founder confirmed this is THEIR Clarity
// project (verified from the install snippet), so it's safe as a zero-config
// default; NEXT_PUBLIC_CLARITY_ID still overrides it.
const GA_ID = process.env.NEXT_PUBLIC_GA_ID || '';
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID || 'wkxxtbufn3';
// Vercel Web Analytics + Speed Insights require the project-level toggle
// in the Vercel dashboard. When the toggle is OFF, `/_vercel/insights/script.js`
// 404s and the browser logs MIME-type errors. Gate the components behind an
// explicit env flag so they only mount once the dashboard has been enabled.
// To turn on: set NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS=true in Vercel env vars
// AND enable Web Analytics + Speed Insights in the Vercel project dashboard.
const VERCEL_ANALYTICS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS === 'true';

export default function AnalyticsLoader() {
  const { consent, preferences } = useCookieConsent();
  const allowed = consent === 'accepted' || (consent === 'customised' && preferences?.analytics === true);

  if (!allowed) return null;

  return (
    <>
      {VERCEL_ANALYTICS_ENABLED && (
        <>
          <Analytics />
          <SpeedInsights />
        </>
      )}
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
