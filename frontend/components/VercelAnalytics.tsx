'use client';

import { Analytics } from '@vercel/analytics/next';
import { isExcludedFromAnalytics } from '@/lib/analyticsExclude';

// Vercel Analytics, filtered to the STOREFRONT.
//
// Out of the box it counts every page, including the admin — so the founder
// working through 63 admin screens on a shop with little traffic becomes most
// of the "visitors". Those numbers then feed decisions about where customers
// drop, which is the one place a polluted figure does real damage.
//
// What to exclude is NOT decided here: lib/analyticsExclude.ts owns it, and our
// own beacon (lib/track.ts) reads the same rule, so the two trackers cannot
// drift into counting different populations. They already had — this file
// dropped the preview surfaces and track.ts did not.
//
// Returning null from beforeSend drops the event entirely — nothing is sent,
// so admin URLs never reach Vercel at all rather than being filtered later in
// a dashboard query.
export default function VercelAnalytics() {
  return (
    <Analytics
      beforeSend={event => {
        try {
          const { pathname, search } = new URL(event.url);
          if (isExcludedFromAnalytics(pathname, search)) return null;
        } catch {
          // An unparseable URL is not a reason to lose a real pageview.
        }
        return event;
      }}
    />
  );
}
