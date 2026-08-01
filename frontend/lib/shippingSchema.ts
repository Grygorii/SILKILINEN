/**
 * Shipping + return policy as schema.org structured data fragments.
 * Used in the Product JSON-LD on the PDP so Google's merchant-listing
 * audit stops flagging missing `shippingDetails` and `hasMerchantReturnPolicy`.
 *
 * SINGLE SOURCE OF TRUTH: backend/services/shipping.js (admin-overridable at
 * Settings → Shipping) served publicly by /api/shipping. These tiers were
 * previously copied here "to avoid a round-trip" — and drifted, so the
 * structured data told Google free shipping started at €250/€200/€300 while
 * checkout actually gave it at €150. A mismatch between structured data and the
 * real offer invalidates the merchant listing, so the numbers are now fetched.
 * The response is cached (s-maxage=300) and the PDP already awaits other data,
 * so the cost is negligible; FALLBACK_TIERS only apply if the API is unreachable.
 */

export type ShippingTier = {
  label?: string;
  countries: string[] | null; // null = worldwide fallback
  cost: number;
  freeThreshold: number;
  deliveryMin: number;
  deliveryMax: number;
};

// Mirrors backend defaults — used ONLY when /api/shipping can't be reached.
const FALLBACK_TIERS: ShippingTier[] = [
  { countries: ['IE'], cost: 4.99, freeThreshold: 150, deliveryMin: 3, deliveryMax: 5 },
  { countries: ['GB', 'IM', 'JE', 'GG'], cost: 14.99, freeThreshold: 150, deliveryMin: 3, deliveryMax: 5 },
  { countries: ['AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR','HU','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK','NO','CH','IS','LI'], cost: 9.99, freeThreshold: 150, deliveryMin: 5, deliveryMax: 10 },
  { countries: ['US', 'CA', 'AU', 'NZ'], cost: 14.99, freeThreshold: 150, deliveryMin: 7, deliveryMax: 14 },
];

/** Live tiers from the same source checkout uses. Fail-soft to the defaults. */
export async function getShippingTiers(): Promise<ShippingTier[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/shipping`, { next: { revalidate: 300 } });
    if (!res.ok) return FALLBACK_TIERS;
    const data = await res.json();
    const tiers: ShippingTier[] = Array.isArray(data?.tiers) ? data.tiers : [];
    const usable = tiers.filter(t => Number.isFinite(t?.cost) && Number.isFinite(t?.freeThreshold));
    return usable.length ? usable : FALLBACK_TIERS;
  } catch {
    return FALLBACK_TIERS;
  }
}

/** The threshold that applies everywhere (the lowest live one) — for storefront copy. */
export async function getFreeShippingThreshold(): Promise<number> {
  const tiers = await getShippingTiers();
  const vals = tiers.map(t => t.freeThreshold).filter(n => Number.isFinite(n));
  return vals.length ? Math.min(...vals) : 150;
}

export async function shippingDetailsFor(productPrice: number) {
  const tiers = await getShippingTiers();
  return tiers.flatMap(tier => (tier.countries || []).map(country => {
    // If the product alone meets the free-shipping threshold, the
    // shipping rate on its Offer is effectively zero.
    const free = productPrice >= tier.freeThreshold;
    return {
      '@type': 'OfferShippingDetails',
      shippingDestination: { '@type': 'DefinedRegion', addressCountry: country },
      shippingRate: {
        '@type': 'MonetaryAmount',
        value: free ? 0 : tier.cost,
        currency: 'EUR',
      },
      deliveryTime: {
        '@type': 'ShippingDeliveryTime',
        handlingTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 2, unitCode: 'DAY' },
        transitTime: { '@type': 'QuantitativeValue', minValue: tier.deliveryMin, maxValue: tier.deliveryMax, unitCode: 'DAY' },
      },
    };
  }));
}

export const merchantReturnPolicy = {
  '@type': 'MerchantReturnPolicy',
  applicableCountry: ['IE', 'GB', 'EU', 'US', 'CA', 'AU'],
  returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
  merchantReturnDays: 14,
  returnMethod: 'https://schema.org/ReturnByMail',
  returnFees: 'https://schema.org/FreeReturn',
};
