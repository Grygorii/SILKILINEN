'use client';

import { useEffect } from 'react';
import { trackProductView } from './RecentlyViewed';

export default function ProductViewTracker({ id, name, price }: { id: string; name: string; price: number }) {
  useEffect(() => {
    trackProductView(id, name, price);
  }, [id, name, price]);

  return null;
}
