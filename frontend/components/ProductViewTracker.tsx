'use client';

import { useEffect } from 'react';
import { trackProductView } from './RecentlyViewed';
import { trackViewItem } from '@/lib/analytics';

export default function ProductViewTracker({ id, name, price, image, category }: { id: string; name: string; price: number; image?: string; category?: string }) {
  useEffect(() => {
    trackProductView(id, name, price, image);     // Recently-viewed (localStorage)
    // Pass the id: the funnel joins view_item to add_to_cart per product to
    // find the pieces that lose their viewers.
    trackViewItem({ name, price, category, productId: id }); // Funnel + GA4 view_item
  }, [id, name, price, image, category]);

  return null;
}
