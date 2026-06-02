'use client';

import Script from 'next/script';

// Public SILKILINEN Google Merchant Center id (same one used by the
// Customer Reviews opt-in). Not a secret — it ships in the page.
const MERCHANT_ID = 5802376609;

declare global {
  interface Window {
    merchantwidget?: { start: (opts: Record<string, unknown>) => void };
  }
}

/**
 * Google Customer Reviews badge — the floating "Google Customer Reviews ★"
 * widget. Google only renders it once the store has enough reviews, so it
 * stays invisible until ratings come in. position/region are intentionally
 * omitted to use Google's default placement; pass them later if we want a
 * specific corner.
 */
export default function GoogleReviewsBadge() {
  return (
    <Script
      id="merchantWidgetScript"
      src="https://www.gstatic.com/shopping/merchant/merchantwidget.js"
      strategy="afterInteractive"
      onLoad={() => {
        window.merchantwidget?.start({ merchant_id: MERCHANT_ID });
      }}
    />
  );
}
