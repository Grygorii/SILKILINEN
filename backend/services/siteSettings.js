'use strict';

// Editable site-wide settings — the founder-facing copy/config that used to be
// hardcoded in many places (the welcome offer, business details). Stored once in
// SystemState under 'siteSettings'; merged over DEFAULTS so a missing/blank field
// falls back to a sensible value and nothing ever renders empty. Cached in
// memory (refreshed on save and at boot) so reads are synchronous and cheap.

const SystemState = require('../models/SystemState');

const KEY = 'siteSettings';

// Every field is public (shown on the storefront), so the public endpoint can
// return the whole object. Keep secrets/keys OUT of here.
const DEFAULTS = {
  welcomeOfferPercent: 10,          // the first-order discount %
  welcomeOfferCode: 'SILK10',       // the advertised code (real per-signup codes are unique)
  supportEmail: 'hello@silkilinen.com',
  brandTagline: 'Pure silk & linen intimates',
  brandLocation: 'Donegal, Ireland',
  freeShippingThreshold: 150,       // mirrors the shipping tiers' free threshold
};

const STRING_FIELDS = ['welcomeOfferCode', 'supportEmail', 'brandTagline', 'brandLocation'];
const NUMBER_FIELDS = ['welcomeOfferPercent', 'freeShippingThreshold'];

let cache = { ...DEFAULTS };

async function loadSiteSettings() {
  try {
    const doc = await SystemState.findOne({ key: KEY }).lean();
    cache = merge(doc && doc.value);
  } catch (err) {
    console.warn('[siteSettings] load failed, using defaults:', err.message);
    cache = { ...DEFAULTS };
  }
  return cache;
}

function merge(value) {
  const out = { ...DEFAULTS };
  if (value && typeof value === 'object') {
    for (const f of STRING_FIELDS) {
      if (typeof value[f] === 'string' && value[f].trim()) out[f] = value[f].trim();
    }
    for (const f of NUMBER_FIELDS) {
      if (typeof value[f] === 'number' && Number.isFinite(value[f]) && value[f] >= 0) out[f] = value[f];
    }
  }
  return out;
}

// Synchronous read of the current effective settings (post-boot load).
function getSiteSettings() {
  return { ...cache };
}

// Validate + persist a patch, refresh the cache. Returns the new effective set.
async function saveSiteSettings(patch) {
  const next = merge({ ...cache, ...sanitise(patch) });
  await SystemState.findOneAndUpdate({ key: KEY }, { value: next }, { upsert: true });
  cache = next;
  return cache;
}

function sanitise(patch) {
  const clean = {};
  if (!patch || typeof patch !== 'object') return clean;
  for (const f of STRING_FIELDS) if (f in patch) clean[f] = String(patch[f] ?? '').slice(0, 200);
  for (const f of NUMBER_FIELDS) if (f in patch) clean[f] = Number(patch[f]);
  return clean;
}

module.exports = { getSiteSettings, saveSiteSettings, loadSiteSettings, DEFAULTS };
