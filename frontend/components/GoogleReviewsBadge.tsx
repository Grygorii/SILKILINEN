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
      // lazyOnload (not afterInteractive) so Next doesn't emit a head preload
      // that competes with the hero during first paint. The badge is a
      // floating footer element invisible until Google has enough reviews —
      // it has no reason to load until the page is idle.
      strategy="lazyOnload"
      onLoad={() => {
        window.merchantwidget?.start({ merchant_id: MERCHANT_ID });
      }}
    />
  );
}
