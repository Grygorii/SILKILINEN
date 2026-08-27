'use client';

import Script from 'next/script';
import { useDeferredReveal } from '@/lib/useDeferredReveal';

// Public SILKILINEN Google Merchant Center id (same one used by the
// Customer Reviews opt-in). Not a secret — it ships in the page.
const MERCHANT_ID = 5802376609;

declare global {
  interface Window {
    merchantwidget?: { start: (opts: Record<string, unknown>) => void };
  }
}

/**
 * Google Customer Reviews badge — the floating seller-rating widget.
 *
 * Mounted in the Footer, which puts it on every storefront page; Google's own
 * CSS then fixes it to a corner, so "in the footer" means "over the hero". On
 * the homepage it sat bottom-right while the contact bubble sat bottom-left,
 * bracketing "Shop the collection" before the visitor had decided anything.
 *
 * Held back until she has scrolled past the first screen, by the same rule the
 * contact bubble uses. That also means the script no longer loads during first
 * paint at all — it was already lazyOnload, but not loading is cheaper than
 * loading late.
 *
 * ⚠️ This is the BADGE, not the survey. The survey — the post-purchase opt-in
 * that actually collects the ratings — is GoogleCustomerReviews on the order
 * success page, and it is the half that earns the rating. Removing this badge
 * costs nothing but the display; removing that would stop the ratings arriving.
 */
export default function GoogleReviewsBadge() {
  const revealed = useDeferredReveal();
  if (!revealed) return null;

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
