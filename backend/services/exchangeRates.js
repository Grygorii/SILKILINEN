'use strict';

// EUR-base exchange rates (ECB data via frankfurter.app — free, no key), cached
// in-memory and refreshed every few hours. Falls back to recent static rates if
// the fetch fails, so prices and checkout NEVER break on a bad network call.
//
// EUR is the canonical currency everywhere in the app (product prices, order
// economics, reporting). These rates are used only at the two edges: display
// (what the shopper sees) and the Stripe charge currency at checkout.

const SUPPORTED = {
  EUR: { symbol: '€', label: 'EUR', stripe: 'eur' },
  GBP: { symbol: '£', label: 'GBP', stripe: 'gbp' },
  USD: { symbol: '$', label: 'USD', stripe: 'usd' },
};

// Sane recent fallbacks (only used if the live fetch fails on a cold cache).
const FALLBACK = { EUR: 1, GBP: 0.84, USD: 1.08 };
const TTL_MS = 6 * 60 * 60 * 1000; // refresh at most every 6h

let cache = { rates: { ...FALLBACK }, at: 0 };

async function refresh() {
  try {
    const to = Object.keys(SUPPORTED).filter(c => c !== 'EUR').join(',');
    const res = await fetch(`https://api.frankfurter.app/latest?from=EUR&to=${to}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rates = { EUR: 1 };
    for (const c of Object.keys(SUPPORTED)) {
      if (c === 'EUR') continue;
      const r = Number(data?.rates?.[c]);
      rates[c] = Number.isFinite(r) && r > 0 ? r : FALLBACK[c];
    }
    cache = { rates, at: Date.now() };
  } catch (err) {
    console.warn('[rates] live fetch failed, using fallback:', err.message);
    if (!cache.at) cache = { rates: { ...FALLBACK }, at: Date.now() };
  }
}

async function getRates() {
  if (Date.now() - cache.at > TTL_MS) await refresh();
  return cache.rates;
}

function isSupported(code) {
  return !!SUPPORTED[String(code || '').toUpperCase()];
}

function normalise(code) {
  const c = String(code || 'EUR').toUpperCase();
  return SUPPORTED[c] ? c : 'EUR';
}

// Convert an EUR amount to `code`, rounded to 2 decimal places. Returns the
// converted amount AND the rate used (so callers can record it on the order).
async function convert(eurAmount, code) {
  const currency = normalise(code);
  const rates = await getRates();
  const rate = rates[currency] || 1;
  return { amount: Math.round(Number(eurAmount) * rate * 100) / 100, rate, currency };
}

module.exports = { SUPPORTED, getRates, convert, isSupported, normalise, refresh };
