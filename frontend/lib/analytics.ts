import { trackClientEvent } from './track';

// window.pintrk is declared globally in components/PinterestTag.tsx.
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    clarity?: (...args: unknown[]) => void;
  }
}

function hasConsent(): boolean {
  if (typeof window === 'undefined') return false;
  // Aligns with CookieConsentContext's STORAGE_KEY. (Was checking the legacy
  // 'silkilinen_cookie_consent'='all' key that the current banner no longer
  // writes — which silently blocked every third-party event.) Per-pixel guards
  // below give the precise gating: a script's global only exists once its own
  // consent category was accepted.
  const v = localStorage.getItem('silkilinen:cookieConsent');
  return v === 'accepted' || v === 'customised';
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
  purchase:    { event: 'checkout',  map: p => ({ value: p.value, order_quantity: p.num_items ?? 1, currency: 'EUR', order_id: p.transaction_id, event_id: p.transaction_id }) },
};

export function trackEvent(name: string, properties: Record<string, unknown> = {}) {
  // First-party store ALWAYS records the event (same posture as Visit tracking)
  // — it's same-origin, owned, and the one signal that can't be ad-blocked or
  // silently flow to someone else's account. Third-party tools below stay gated
  // behind cookie consent.
  trackClientEvent(name, properties);

  if (!hasConsent()) return;
  gtagFire(name, properties);
  clarityFire(name);
  const pin = PINTEREST_EVENTS[name];
  if (pin) pintrkFire(pin.event, pin.map(properties));
}

export function trackViewItem(product: { name: string; price: number; category?: string }) {
  trackEvent('view_item', {
    currency: 'EUR',
    value: product.price,
    items: [{ item_name: product.name, item_category: product.category, price: product.price }],
  });
}

export function trackAddToCart(product: { name: string; price: number; category?: string }) {
  trackEvent('add_to_cart', {
    currency: 'EUR',
    value: product.price,
    items: [{ item_name: product.name, item_category: product.category, price: product.price, quantity: 1 }],
  });
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

export function trackPurchase(orderId: string, value: number) {
  trackEvent('purchase', { transaction_id: orderId, currency: 'EUR', value });
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
