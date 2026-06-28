'use client';

import { usePathname } from 'next/navigation';
import Breadcrumbs from './Breadcrumbs';

// Auto breadcrumb for single-segment static pages, where the label is knowable
// straight from the path. Deep named-entity pages (product, collection, journal
// article) render their own breadcrumb with the real title, so they're
// deliberately absent here. Funnel/app pages (checkout, account, wishlist…) get
// none — a path back would only distract from the task.
const STATIC_LABELS: Record<string, string> = {
  shop: 'Shop',
  about: 'About',
  faq: 'FAQ',
  shipping: 'Shipping',
  returns: 'Returns',
  'size-guide': 'Size guide',
  contact: 'Contact',
  'privacy-policy': 'Privacy policy',
  terms: 'Terms',
  'care-guide': 'Care guide',
  'gift-wrapping': 'Gift wrapping',
  reviews: 'Reviews',
};

export default function SiteBreadcrumbs() {
  const pathname = usePathname();
  const segs = (pathname || '/').split('/').filter(Boolean);
  if (segs.length !== 1) return null; // home (0 segments) or deep pages (2+) handled elsewhere
  const label = STATIC_LABELS[segs[0]];
  if (!label) return null;
  return <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label }]} withSchema />;
}
