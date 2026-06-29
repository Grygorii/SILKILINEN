'use client';

import { Check } from 'lucide-react';
import { useIsUK } from '@/lib/useIsUK';
import styles from './UKShipBadge.module.css';

// Small reassurance line shown only to UK (GB) visitors at the decision moments
// (product page, checkout): their order ships from within the UK, so no customs.
export default function UKShipBadge({ className }: { className?: string }) {
  const isUK = useIsUK();
  if (isUK !== true) return null;
  return (
    <p className={`${styles.badge}${className ? ` ${className}` : ''}`}>
      <Check size={14} strokeWidth={2} aria-hidden="true" />
      Ships from the UK — no customs or duties
    </p>
  );
}
