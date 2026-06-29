'use client';

import { useCurrency } from '@/context/CurrencyContext';

// Renders a EUR amount in the shopper's selected currency. Works inside server
// components too (it's a client component). On first paint it shows EUR to match
// SSR; after mount it flips to the saved currency — so there's no hydration
// mismatch, just a brief settle for returning non-EUR shoppers.
export default function Price({ eur, className }: { eur: number; className?: string }) {
  const { format } = useCurrency();
  return <span className={className}>{format(eur)}</span>;
}
