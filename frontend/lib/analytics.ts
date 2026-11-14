import { trackClientEvent } from './track';
import { hasAnalyticsConsent } from './analyticsConsent';
import { isBrowserExcludedFromAnalytics } from './analyticsExclude';

// window.pintrk is declared globally in components/PinterestTag.tsx.
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    clarity?: (...args: unknown[]) => void;
  }
}

function gtagFire(event: string, params: Record<string, unknown>) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', event, params);
  }
}

function clarityFire(event: string) {
  if (typeof window !== 'undefined' && typeof window.clarity === 'function') {
    window.clarity('event', event);
  }
}

function pintrkFire(event: string, params: Record<string, unknown>) {
  if (typeof window !== 'undefined' && typeof window.pintrk === 'function') {
    window.pintrk('track', event, params);
  }
}

// Map our commerce events onto Pinterest's standard event names + params, so the
// (marketing-consented) Pinterest tag gets addtocart/checkout conversions.
const PINTEREST_EVENTS: Record<string, { event: string; map: (p: Record<string, unknown>) => Record<string, unknown> }> = {
  add_to_cart: { event: 'addtocart', map: p => ({ value: p.value, order_quantity: 1, currency: 'EUR' }) },
  purchase:    { event: 'checkout',  map: p => ({ value: p.value, order_quantity: p.num_items ?? 1, currency: p.currency || 'EUR', order_id: p.transaction_id, event_id: p.transaction_id }) },
};

export function trackEvent(name: string, properties: Record<string, unknown> = {}, productId?: string) {
  // The first-party event stream is analytics too: it can join a browser's
  // page views to an order, so it must use the same consent gate as pixels.
  if (!hasAnalyticsConsent() || isBrowserExcludedFromAnalytics()) return;
  trackClientEvent(name, properties, productId);

  gtagFire(name, properties);
  clarityFire(name);
  const pin = PINTEREST_EVENTS[name];
  if (pin) pintrkFire(pin.event, pin.map(properties));
}

export function trackViewItem(product: { name: string; price: number; category?: string; productId?: string }) {
  trackEvent('view_item', {
    currency: 'EUR',
    value: product.price,
    items: [{ item_name: product.name, item_category: product.category, price: product.price }],
  }, product.productId);
}

export function trackAddToCart(product: { name: string; price: number; category?: string; productId?: string }) {
  trackEvent('add_to_cart', {
    currency: 'EUR',
    value: product.price,
    items: [{ item_name: product.name, item_category: product.category, price: product.price, quantity: 1 }],
  }, product.productId);
}

export function trackRemoveFromCart(name: string, price: number) {
  trackEvent('remove_from_cart', {
    currency: 'EUR',
    value: price,
    items: [{ item_name: name, price }],
  });
}

export function trackBeginCheckout(total: number, itemCount: number) {
  trackEvent('begin_checkout', {
    currency: 'EUR',
    value: total,
    num_items: itemCount,
  });
}

export function trackPurchase(orderId: string, value: number, currency: string = 'EUR') {
  trackEvent('purchase', { transaction_id: orderId, currency, value });
}

export function trackNewsletterSignup() {
  trackEvent('newsletter_signup', {});
}

export function trackSearch(query: string) {
  trackEvent('search', { search_term: query });
}

export function trackCartOpen() {
  trackEvent('cart_open', {});
}

export function trackScrollDepth(pct: 25 | 50 | 75 | 100) {
  trackEvent('scroll_depth', { percent_scrolled: pct });
}

export {};
