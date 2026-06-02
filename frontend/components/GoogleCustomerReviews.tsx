'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Script from 'next/script';

const API = process.env.NEXT_PUBLIC_API_URL;
// Public SILKILINEN Google Merchant Center id (not a secret — it ships in
// the page either way). Bump here if the Merchant Center account changes.
const MERCHANT_ID = 5802376609;

declare global {
  interface Window {
    gapi?: {
      load: (name: string, cb: () => void) => void;
      surveyoptin?: { render: (opts: Record<string, unknown>) => void };
    };
  }
}

type Confirmation = { orderId: string; email: string; country: string; estimatedDeliveryDate: string };

/**
 * Google Customer Reviews opt-in. Mounted on the success page; reads the
 * Stripe payment_intent + client_secret that Stripe appends to the redirect
 * URL, fetches the buyer's own order summary from the backend (gated by that
 * client_secret), then renders Google's survey opt-in so Google can collect a
 * review and award store rating stars.
 *
 * Entirely non-critical: if anything is missing or fails, it renders nothing
 * and the confirmation page is unaffected.
 */
export default function GoogleCustomerReviews() {
  const params = useSearchParams();
  const paymentIntent = params.get('payment_intent');
  const clientSecret = params.get('payment_intent_client_secret');
  const [data, setData] = useState<Confirmation | null>(null);

  useEffect(() => {
    if (!API || !paymentIntent || !clientSecret) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${API}/api/v2/checkout/confirmation?payment_intent=${encodeURIComponent(paymentIntent)}&client_secret=${encodeURIComponent(clientSecret)}`,
        );
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json?.email && json?.country) setData(json);
      } catch {
        /* GCR is non-critical — never block the confirmation page */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paymentIntent, clientSecret]);

  if (!data) return null;

  return (
    <Script
      src="https://apis.google.com/js/platform.js"
      strategy="afterInteractive"
      onLoad={() => {
        window.gapi?.load('surveyoptin', () => {
          window.gapi?.surveyoptin?.render({
            merchant_id: MERCHANT_ID,
            order_id: data.orderId,
            email: data.email,
            delivery_country: data.country,
            estimated_delivery_date: data.estimatedDeliveryDate,
          });
        });
      }}
    />
  );
}
