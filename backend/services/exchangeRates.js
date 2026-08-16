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

// When the provider is down we must NOT retry on every request. getRates()
// awaits refresh(), and the fetch has a 6s timeout — so a failing provider
// added six seconds to every checkout quote and every intent creation, while
// hammering an API that was already struggling. Back off and keep serving the
// rates we have.
const RETRY_MS = 60 * 1000;
let lastAttemptAt = 0;

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
    // Serving yesterday's ECB rates is materially better than blocking a sale,
    // and far better than the hardcoded fallback — so a stale cache is KEPT
    // rather than replaced. Only a cold start falls back to the constants.
    const ageH = cache.at ? Math.round((Date.now() - cache.at) / 3600000) : 0;
    console.warn(`[rates] live fetch failed (${err.message}); serving ${cache.at ? `cached rates ${ageH}h old` : 'hardcoded fallback'}`);
    if (!cache.at) cache = { rates: { ...FALLBACK }, at: Date.now() };
  }
}

async function getRates() {
  const now = Date.now();
  // Refresh when stale, but never more often than RETRY_MS — otherwise a
  // failing provider turns every request into a 6-second wait.
  if (now - cache.at > TTL_MS && now - lastAttemptAt > RETRY_MS) {
    lastAttemptAt = now;
    await refresh();
  }
  return cache.rates;
}

/** How old the cached rates are, in hours. Surfaced so a prolonged outage is
 *  visible rather than silently charging on stale conversions. */
function ratesAgeHours() {
  return cache.at ? (Date.now() - cache.at) / 3600000 : Infinity;
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

module.exports = {
  ratesAgeHours, SUPPORTED, getRates, convert, isSupported, normalise, refresh };
