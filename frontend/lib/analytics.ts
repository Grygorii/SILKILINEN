declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    clarity?: (...args: unknown[]) => void;
  }
}

function hasConsent(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('silkilinen_cookie_consent') === 'all';
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

export function trackEvent(name: string, properties: Record<string, unknown> = {}) {
  if (!hasConsent()) return;
  gtagFire(name, properties);
  clarityFire(name);
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
