'use client';

import Script from 'next/script';
import { useSyncExternalStore } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { useCookieConsent } from '@/context/CookieConsentContext';
import { allowsAnalytics } from '@/lib/analyticsConsent';
import { isBrowserExcludedFromAnalytics, subscribeToBrowserAnalyticsExclusion } from '@/lib/analyticsExclude';

// Both default to the founder's OWN, confirmed properties (GA4 G-XZG6XTZ3S8 and
// Clarity x940yl1bn0), so analytics works zero-config. The NEXT_PUBLIC_* env vars
// still override either. Both load only after cookie consent (see below).
const GA_ID = process.env.NEXT_PUBLIC_GA_ID || 'G-XZG6XTZ3S8';
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID || 'x940yl1bn0';
// Vercel Web Analytics mounts in VercelAnalytics.tsx so its shared exclusion
// filter cannot be bypassed here. Speed Insights needs the project-level toggle
// in the Vercel dashboard. When it is OFF, `/_vercel/insights/script.js` 404s,
// so gate that component behind an explicit environment flag.
// To turn it on: set NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS=true in Vercel env
// vars and enable Web Analytics + Speed Insights in the Vercel project dashboard.
const VERCEL_ANALYTICS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS === 'true';

export default function AnalyticsLoader() {
  const { consent, preferences } = useCookieConsent();
  const allowed = allowsAnalytics(consent, preferences);
  const browserExcluded = useSyncExternalStore(subscribeToBrowserAnalyticsExclusion, isBrowserExcludedFromAnalytics, () => false);

  if (!allowed || browserExcluded) return null;

  return (
    <>
      {VERCEL_ANALYTICS_ENABLED && (
        <SpeedInsights />
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
