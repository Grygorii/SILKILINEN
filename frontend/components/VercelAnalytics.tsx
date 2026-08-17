'use client';

import { Analytics } from '@vercel/analytics/next';

// Vercel Analytics, filtered to the STOREFRONT.
//
// Out of the box it counts every page, including the admin — so the founder
// working through 63 admin screens on a shop with little traffic becomes most
// of the "visitors". Those numbers then feed decisions about where customers
// drop, which is the one place a polluted figure does real damage.
//
// lib/track.ts already refuses to record anything under /admin (twice, in
// trackVisit and trackClientEvent). This makes the second tracker agree with
// the first: two systems counting different populations is worse than either
// one alone, because the disagreement is invisible until someone compares them.
//
// Returning null from beforeSend drops the event entirely — nothing is sent,
// so admin URLs never reach Vercel at all rather than being filtered later in
// a dashboard query.
export default function VercelAnalytics() {
  return (
    <Analytics
      beforeSend={event => {
        try {
          const path = new URL(event.url).pathname;
          // Admin, its login, and the preview/edit surfaces the founder uses —
          // all of them are work, not shopping.
          if (path.startsWith('/admin')) return null;
          if (path.startsWith('/journal/preview')) return null;
          if (path.includes('/preview/')) return null;
        } catch {
          // An unparseable URL is not a reason to lose a real pageview.
        }
        return event;
      }}
    />
  );
}
