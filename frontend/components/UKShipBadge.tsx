'use client';

import { Check } from 'lucide-react';
import { UK_SHIPPING, useUkShipping } from '@/lib/ukShipping';
import styles from './UKShipBadge.module.css';

// The reassurance line at the decision moments — product page, cart, checkout.
// The copy and the show/hide rule both live in lib/ukShipping.ts.
export default function UKShipBadge({ className }: { className?: string }) {
  if (!useUkShipping()) return null;
  return (
    <p className={`${styles.badge}${className ? ` ${className}` : ''}`}>
      <Check size={14} strokeWidth={2} aria-hidden="true" />
      {UK_SHIPPING.badge}
    </p>
  );
}
