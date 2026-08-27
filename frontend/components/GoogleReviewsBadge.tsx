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
 * ⚠️ NOT CURRENTLY MOUNTED. Removed from components/Footer.tsx at the founder's
 * request. Kept rather than deleted because bringing it back is one line, and
 * the reason it is off is temporary: a badge is only worth showing once there
 * is a seller rating with enough reviews behind it to persuade. A thin rating
 * displayed prominently is worse than no badge.
 *
 * To restore: import it in Footer.tsx and render <GoogleReviewsBadge /> inside
 * the <footer>. It already defers to the first screen (see useDeferredReveal),
 * so it will not open the site the way it did before.
 *
 * ⚠️ This is the BADGE. Do not confuse it with GoogleCustomerReviews on the
 * order-success page — that is the post-purchase survey, it is what actually
 * COLLECTS the ratings, and it is still mounted and must stay. The names are
 * one word apart and removing the wrong one would quietly stop seller ratings
 * ever arriving.
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
