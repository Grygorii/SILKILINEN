'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { confirmationCredentials, confirmationRequest } from '@/lib/purchaseConfirmation';
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

  useEffect(() => {
    const credentials = confirmationCredentials(params);
    if (!API || !credentials) return;
    const { paymentIntent } = credentials;
    const dedupKey = `silkilinen:purchaseTracked:${paymentIntent}`;
    try { if (sessionStorage.getItem(dedupKey)) return; } catch { /* storage blocked */ }

    let cancelled = false;
    (async () => {
      try {
        const res = await confirmationRequest(API, credentials);
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled || typeof json?.value !== 'number' || !Number.isFinite(json.value) || json.value < 0) return;
        trackPurchase(json.orderId || paymentIntent, json.value, json.currency);
        try { sessionStorage.setItem(dedupKey, '1'); } catch { /* storage blocked */ }
      } catch {
        /* conversion tracking is non-critical — never block the page */
      }
    })();
    return () => { cancelled = true; };
  }, [params]);

  return null;
}
