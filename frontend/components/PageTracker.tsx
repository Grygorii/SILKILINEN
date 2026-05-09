'use client';

import { useEffect } from 'react';
import { trackVisit } from '@/lib/track';

export default function PageTracker({ page, productId }: { page: string; productId?: string }) {
  useEffect(() => {
    trackVisit({ page, productId });
  }, [page, productId]);

  return null;
}
