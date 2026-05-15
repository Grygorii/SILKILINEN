// Shipping rate tiers — SILKILINEN ships from Derry, Northern Ireland
// Northern Ireland uses GB country code → treated as UK (no customs for ROI)

const TIERS = [
  {
    countries: ['IE'],
    label: 'Ireland',
    cost: 4.99,
    freeThreshold: 150,
    deliveryMin: 3,
    deliveryMax: 5,
  },
  {
    // GB includes Northern Ireland (IM, JE, GG = Crown dependencies, treated same)
    countries: ['GB', 'IM', 'JE', 'GG'],
    label: 'United Kingdom',
    cost: 14.99,
    freeThreshold: 250,
    deliveryMin: 3,
    deliveryMax: 5,
  },
  {
    countries: [
      'AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR',
      'HU','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK',
      'NO','CH','IS','LI',
    ],
    label: 'Europe',
    cost: 9.99,
    freeThreshold: 200,
    deliveryMin: 5,
    deliveryMax: 10,
  },
  {
    countries: ['US', 'CA', 'AU', 'NZ'],
    label: 'US / Canada / Australia',
    cost: 14.99,
    freeThreshold: 300,
    deliveryMin: 7,
    deliveryMax: 14,
  },
];

const WORLDWIDE = {
  label: 'Worldwide',
  cost: 19.99,
  freeThreshold: 400,
  deliveryMin: 10,
  deliveryMax: 21,
};

function getTierForCountry(countryCode) {
  if (!countryCode) return null;
  const code = countryCode.toUpperCase();
  return TIERS.find(t => t.countries.includes(code)) || WORLDWIDE;
}

/**
 * Calculate shipping for a given country and order subtotal.
 * Returns { cost, isFree, label, freeThreshold, deliveryMin, deliveryMax }
 */
function calculateShipping(countryCode, subtotal = 0) {
  const tier = getTierForCountry(countryCode);
  if (!tier) {
    return { cost: WORLDWIDE.cost, isFree: false, label: WORLDWIDE.label, freeThreshold: WORLDWIDE.freeThreshold, deliveryMin: WORLDWIDE.deliveryMin, deliveryMax: WORLDWIDE.deliveryMax };
  }
  const isFree = subtotal >= tier.freeThreshold;
  return {
    cost: isFree ? 0 : tier.cost,
    isFree,
    label: tier.label,
    freeThreshold: tier.freeThreshold,
    deliveryMin: tier.deliveryMin,
    deliveryMax: tier.deliveryMax,
  };
}

module.exports = { calculateShipping, getTierForCountry };
