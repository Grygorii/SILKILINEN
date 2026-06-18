'use client';

import { useEffect } from 'react';
import { trackProductView } from './RecentlyViewed';
import { trackViewItem } from '@/lib/analytics';

export default function ProductViewTracker({ id, name, price, image, category }: { id: string; name: string; price: number; image?: string; category?: string }) {
  useEffect(() => {
    trackProductView(id, name, price, image);     // Recently-viewed (localStorage)
    trackViewItem({ name, price, category });       // Funnel + GA4 view_item
  }, [id, name, price, image, category]);

  return null;
}
