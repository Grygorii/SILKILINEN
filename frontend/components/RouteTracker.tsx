'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackVisit } from '@/lib/track';
import { pageNameFromPath } from '@/lib/pageName';

// Records a visit for EVERY storefront route.
//
// Tracking used to be opt-in per page, and had been opted into twice: the
// homepage and the product page. /shop, /collections, /journal, /about,
// /checkout and the rest recorded nothing, so the funnel's "Visited the site"
// stage counted a fraction of real arrivals — and every rate computed from it
// was wrong in the flattering direction. Vercel Analytics counting visitors our
// own tracker never saw is what surfaced it.
//
// Mounted once in the shop layout, so a new route is tracked by existing rather
// than by someone remembering. What gets EXCLUDED is still decided in one place
// (lib/analyticsExclude, called inside trackVisit), and product pages keep their
// own tracker because it carries the productId this cannot know.
export default function RouteTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const page = pageNameFromPath(pathname || '/');
    if (!page) return; // owned by a page-level tracker
    trackVisit({ page });
  }, [pathname]);

  return null;
}
