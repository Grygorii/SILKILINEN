'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { trackPurchase } from '@/lib/analytics';

const API = process.env.NEXT_PUBLIC_API_URL;

/**
 * Fires the purchase conversion on the success page — completing the first-party
 * funnel's `purchase` stage and the GA4 `purchase` + Pinterest `checkout` events
 * (Meta Purchase is already sent server-side via CAPI, so it's left alone).
 *
 * Reads the Stripe payment_intent + client_secret from the redirect URL, fetches
 * the buyer's own order value (gated by that secret), and fires once per order
 * (sessionStorage dedup so a refresh doesn't double-count). Renders nothing.
 */
export default function PurchaseTracking() {
  const params = useSearchParams();
  const paymentIntent = params.get('payment_intent');
  const clientSecret = params.get('payment_intent_client_secret');

  useEffect(() => {
    if (!API || !paymentIntent || !clientSecret) return;
    const dedupKey = `silkilinen:purchaseTracked:${paymentIntent}`;
    if (sessionStorage.getItem(dedupKey)) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${API}/api/v2/checkout/confirmation?payment_intent=${encodeURIComponent(paymentIntent)}&client_secret=${encodeURIComponent(clientSecret)}`,
        );
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled || typeof json?.value !== 'number') return;
        sessionStorage.setItem(dedupKey, '1');
        trackPurchase(json.orderId || paymentIntent, json.value);
      } catch {
        /* conversion tracking is non-critical — never block the page */
      }
    })();
    return () => { cancelled = true; };
  }, [paymentIntent, clientSecret]);

  return null;
}
