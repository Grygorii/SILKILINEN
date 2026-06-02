/**
 * Shipping + return policy as schema.org structured data fragments.
 * Used in the Product JSON-LD on the PDP so Google's merchant-listing
 * audit stops flagging missing `shippingDetails` and `hasMerchantReturnPolicy`.
 *
 * The tier numbers here MUST stay in sync with backend/services/shipping.js
 * — the storefront copy and the canonical tier table are intentionally
 * duplicated rather than fetched at request time so the PDP doesn't have
 * to await a backend round-trip just to render structured data.
 */

type ShippingTier = {
  countries: string[];
  cost: number;
  freeThreshold: number;
  deliveryMin: number;
  deliveryMax: number;
};

const TIERS: ShippingTier[] = [
  { countries: ['IE'],                                                                                                                                                                  cost: 4.99,  freeThreshold: 150, deliveryMin: 3, deliveryMax: 5  },
  { countries: ['GB', 'IM', 'JE', 'GG'],                                                                                                                                                cost: 14.99, freeThreshold: 250, deliveryMin: 3, deliveryMax: 5  },
  { countries: ['AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR','HU','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK','NO','CH','IS','LI'],                  cost: 9.99,  freeThreshold: 200, deliveryMin: 5, deliveryMax: 10 },
  { countries: ['US', 'CA', 'AU', 'NZ'],                                                                                                                                                cost: 14.99, freeThreshold: 300, deliveryMin: 7, deliveryMax: 14 },
];

export function shippingDetailsFor(productPrice: number) {
  return TIERS.flatMap(tier => tier.countries.map(country => {
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
