// Indicative shipping rates, shown only when /api/shipping cannot be reached.
//
// ── Why this is a mirror, and why that is tolerated here ──
//
// backend/services/shipping.js is the ONE source of rates, served by
// /api/shipping. PROJECT_MAP's rule is "never hardcode 150", and it exists
// because a duplicated copy of these numbers once told Google free shipping at
// €250/€200/€300 while checkout gave it at €150.
//
// This is a second copy of those numbers, deliberately: a shipping page with no
// rates on it is worse than one showing last-known figures, and the outage
// window is real — the CDN serves stale for a day, so reaching this at all
// means the API has been unreachable for longer than that.
//
// Two things make it safe rather than a repeat of the old bug:
//
//   1. backend/tests/shippingFallback.test.js compares these numbers to the
//      backend's own defaults on every CI run, so they cannot drift in code.
//   2. The page SAYS the figures are indicative when it falls back — see
//      ShippingRates. That matters because these mirror the code DEFAULTS, and
//      live rates are defaults plus admin overrides, so the moment a rate is
//      edited in admin this copy is out of date by construction. No test can
//      fix that; only saying so can.
//
// If you find yourself reading these numbers for any purpose other than
// rendering a degraded shipping page, stop — you want /api/shipping.

export type ShippingTier = {
  label: string;
  cost: number;
  freeThreshold: number;
  deliveryMin: number;
  deliveryMax: number;
};

export const FALLBACK_TIERS: ShippingTier[] = [
  { label: 'Ireland', cost: 4.99, freeThreshold: 150, deliveryMin: 3, deliveryMax: 5 },
  { label: 'United Kingdom', cost: 14.99, freeThreshold: 150, deliveryMin: 3, deliveryMax: 5 },
  { label: 'Europe', cost: 9.99, freeThreshold: 150, deliveryMin: 5, deliveryMax: 10 },
  { label: 'US / Canada / Australia', cost: 14.99, freeThreshold: 150, deliveryMin: 7, deliveryMax: 14 },
  { label: 'Worldwide', cost: 19.99, freeThreshold: 150, deliveryMin: 10, deliveryMax: 21 },
];
