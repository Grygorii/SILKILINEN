'use client';

import { useEffect } from 'react';
import { trackProductView } from './RecentlyViewed';

export default function ProductViewTracker({ id, name, price, image }: { id: string; name: string; price: number; image?: string }) {
  useEffect(() => {
    trackProductView(id, name, price, image);
  }, [id, name, price, image]);

  return null;
}
