// Shipping rate tiers — SILKILINEN ships from Derry, Northern Ireland
// Northern Ireland uses GB country code → treated as UK (no customs for ROI)
//
// Rates are editable from the admin (Settings → Shipping). The hardcoded
// tiers below are the DEFAULTS; numeric overrides (cost, freeThreshold,
// deliveryMin/Max) are stored in SystemState under 'shippingRateOverrides'
// and merged into an in-memory cache at boot and on every admin save. The
// public interface stays synchronous — checkout/cart call sites are
// untouched, and any DB problem just means defaults apply.

const SystemState = require('../models/SystemState');

const OVERRIDES_KEY = 'shippingRateOverrides';

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
    freeThreshold: 150,
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
    freeThreshold: 150,
    deliveryMin: 5,
    deliveryMax: 10,
  },
  {
    countries: ['US', 'CA', 'AU', 'NZ'],
    label: 'US / Canada / Australia',
    cost: 14.99,
    freeThreshold: 150,
    deliveryMin: 7,
    deliveryMax: 14,
  },
];

const WORLDWIDE = {
  label: 'Worldwide',
  cost: 19.99,
  freeThreshold: 150,
  deliveryMin: 10,
  deliveryMax: 21,
};

// label → { cost?, freeThreshold?, deliveryMin?, deliveryMax? }
let overrides = {};

const NUMERIC_FIELDS = ['cost', 'freeThreshold', 'deliveryMin', 'deliveryMax'];

function effectiveTier(tier) {
  const o = overrides[tier.label];
  if (!o) return tier;
  const merged = { ...tier };
  for (const f of NUMERIC_FIELDS) {
    if (typeof o[f] === 'number' && Number.isFinite(o[f]) && o[f] >= 0) merged[f] = o[f];
  }
  return merged;
}

// Load saved overrides into the in-memory cache. Called once after the DB
// connects and again after every admin save. Failures are non-fatal —
// defaults keep checkout working.
async function loadShippingOverrides() {
  try {
    const doc = await SystemState.findOne({ key: OVERRIDES_KEY }).lean();
    overrides = (doc && typeof doc.value === 'object' && doc.value) || {};
  } catch (err) {
    console.warn('[shipping] could not load rate overrides, using defaults:', err.message);
    overrides = {};
  }
}

// Persist new overrides (validated by the route) and refresh the cache.
async function saveShippingOverrides(next) {
  await SystemState.findOneAndUpdate(
    { key: OVERRIDES_KEY },
    { value: next },
    { upsert: true },
  );
  overrides = next;
}

// All tiers with defaults + currently effective values — for the admin UI.
function getEffectiveRates() {
  return [...TIERS, WORLDWIDE].map(t => ({
    label: t.label,
    countries: t.countries || null, // null = worldwide fallback
    defaults: { cost: t.cost, freeThreshold: t.freeThreshold, deliveryMin: t.deliveryMin, deliveryMax: t.deliveryMax },
    effective: (({ cost, freeThreshold, deliveryMin, deliveryMax }) => ({ cost, freeThreshold, deliveryMin, deliveryMax }))(effectiveTier(t)),
  }));
}

function getTierForCountry(countryCode) {
  if (!countryCode) return null;
  const code = countryCode.toUpperCase();
  const tier = TIERS.find(t => t.countries.includes(code)) || WORLDWIDE;
  return effectiveTier(tier);
}

/**
 * Calculate shipping for a given country and order subtotal.
 * Returns { cost, isFree, label, freeThreshold, deliveryMin, deliveryMax }
 */
function calculateShipping(countryCode, subtotal = 0) {
  const tier = getTierForCountry(countryCode);
  if (!tier) {
    const w = effectiveTier(WORLDWIDE);
    return { cost: w.cost, isFree: false, label: w.label, freeThreshold: w.freeThreshold, deliveryMin: w.deliveryMin, deliveryMax: w.deliveryMax };
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

module.exports = {
  calculateShipping,
  getTierForCountry,
  loadShippingOverrides,
  saveShippingOverrides,
  getEffectiveRates,
  NUMERIC_FIELDS,
};
