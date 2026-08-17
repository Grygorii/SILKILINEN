'use strict';

// Vercel Web Analytics reader (read-only).
//
// The <Analytics/> component was added to the storefront, which sends data TO
// Vercel — and nothing here could read it back, so the numbers lived in a
// dashboard the agents cannot see. This closes that loop: the admin, the health
// panel and the advisor can all ask "how many people actually arrived".
//
// Why it is worth having alongside our own clickstream, which is richer: it is
// an INDEPENDENT count of the same population. Our beacon is JavaScript we
// wrote, posting to our own API — ad blockers, a bad deploy or a thrown
// exception silence it, and a silent tracker is indistinguishable from an empty
// shop. Two counts that should agree are a guard; one count is a guess.
//
// Inert until VERCEL_API_TOKEN + VERCEL_PROJECT_ID are set (VERCEL_TEAM_ID too,
// for a project owned by a team — which this one is).
//
// API: https://vercel.com/docs/analytics/web-analytics-api
//   GET /v1/query/web-analytics/visits/count      -> { data: { pageviews, visitors } }
//   GET /v1/query/web-analytics/visits/aggregate  -> { data: [ { <dim>, count, visitors } ] }
// Production traffic only, and only since Web Analytics was switched on.

const API_BASE = 'https://api.vercel.com/v1/query/web-analytics';
const TIMEOUT_MS = 6000;
const TTL_MS = 15 * 60 * 1000; // traffic moves slowly; 15min is plenty
const RETRY_MS = 60 * 1000;    // never hammer a failing provider

let cache = { data: null, at: 0 };
let lastAttemptAt = 0;

function isConfigured() {
  return Boolean(process.env.VERCEL_API_TOKEN && process.env.VERCEL_PROJECT_ID);
}

function qs(params) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  }
  if (process.env.VERCEL_TEAM_ID) p.set('teamId', process.env.VERCEL_TEAM_ID);
  p.set('projectId', process.env.VERCEL_PROJECT_ID);
  return p.toString();
}

/**
 * One API call. Returns the parsed body, or throws an Error carrying `notEnabled`
 * so the caller can tell "switched off" from "broken" — see classify() below.
 *
 * @param {Function} [fetchImpl] injected in tests; defaults to global fetch
 */
async function call(path, params, fetchImpl = fetch) {
  const res = await fetchImpl(`${API_BASE}${path}?${qs(params)}`, {
    headers: { Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    let code = '';
    let message = '';
    try {
      const body = await res.json();
      code = body?.error?.code || '';
      message = body?.error?.message || '';
    } catch { /* a non-JSON error body is still an error */ }

    // 404 {"error":{"code":"not_found","message":"Web Analytics not found."}}
    // means this token cannot READ the analytics — it does NOT mean the project
    // has none. Observed live: the Vercel dashboard showed 7 visitors and 23
    // page views for this project while this exact call 404'd, on a Hobby plan.
    // The first version of this file asserted "never been enabled" and sent the
    // founder to switch on something already running — the precise failure this
    // service exists to prevent, committed by the service itself.
    //
    // Whatever the cause (plan-gated API access being the likeliest), the honest
    // statement is the same: we cannot read it from here. Never "0 visitors".
    const err = new Error(message || `HTTP ${res.status}`);
    err.unreadable = res.status === 404 && code === 'not_found';
    err.status = res.status;
    throw err;
  }

  return res.json();
}

function dayString(d) {
  return new Date(d).toISOString().slice(0, 10);
}

/**
 * Traffic for the last `days` days.
 *
 * Never throws and never invents a number. Every outcome is named, because the
 * whole point of this reader is that the founder can tell them apart:
 *   { configured: false }                     — no token set; nothing to say
 *   { configured: true, enabled: false }      — installed but never switched on
 *   { configured: true, enabled: true, ... }  — real figures
 *   { configured: true, error }                — the call failed; say so
 */
async function getTraffic({ days = 14, fetchImpl = fetch } = {}) {
  if (!isConfigured()) return { configured: false };

  const until = new Date();
  const since = new Date(until.getTime() - days * 24 * 60 * 60 * 1000);
  const range = { since: dayString(since), until: dayString(until) };

  try {
    const [count, paths, referrers, devices] = await Promise.all([
      call('/visits/count', range, fetchImpl),
      call('/visits/aggregate', { ...range, by: 'requestPath', limit: 10 }, fetchImpl),
      call('/visits/aggregate', { ...range, by: 'referrerHostname', limit: 10 }, fetchImpl),
      call('/visits/aggregate', { ...range, by: 'deviceType', limit: 5 }, fetchImpl),
    ]);

    const rows = (res, key) => (Array.isArray(res?.data) ? res.data : [])
      .map(r => ({ label: String(r?.[key] ?? r?.value ?? ''), count: Number(r?.count) || 0, visitors: Number(r?.visitors) || 0 }))
      .filter(r => r.label);

    return {
      configured: true,
      enabled: true,
      days,
      pageviews: Number(count?.data?.pageviews) || 0,
      visitors: Number(count?.data?.visitors) || 0,
      topPaths: rows(paths, 'requestPath'),
      topReferrers: rows(referrers, 'referrerHostname'),
      devices: rows(devices, 'deviceType'),
    };
  } catch (err) {
    if (err.unreadable) {
      return {
        configured: true,
        // Deliberately NOT `enabled: false`. We know nothing about whether it is
        // enabled — only that this token cannot read it. The dashboard may be
        // full of data, and it was when this was last checked.
        readable: false,
        detail: 'Vercel returned "Web Analytics not found" for this token. That means we cannot READ the figures — not that none exist; the Vercel dashboard may well be showing traffic.',
        fix: 'Check Vercel → the silkilinen project → Analytics. If the dashboard has data, this is API access rather than collection — the Web Analytics API is not available on every plan. If the dashboard is empty too, enable it there; the storefront already sends the events.',
      };
    }
    return { configured: true, error: err.message };
  }
}

/**
 * Cached wrapper — the dashboard, health panel and advisor all want this and
 * must not each spend an API round trip. Keeps a STALE cache when the provider
 * fails (the rates service learned this lesson the hard way) and backs off so a
 * failing API cannot add six seconds to every admin page load.
 */
async function getTrafficCached(opts = {}) {
  const now = Date.now();
  if (cache.data && now - cache.at < TTL_MS) return cache.data;
  if (now - lastAttemptAt < RETRY_MS && cache.data) return cache.data;

  lastAttemptAt = now;
  const data = await getTraffic(opts);
  // Only cache an answer worth repeating. An error is not worth serving for
  // 15 minutes; "not enabled" is, since it cannot change without a human.
  if (!data.error) cache = { data, at: now };
  return data;
}

// ── Do our two counts of the same people agree? ──
//
// Exact agreement is not the goal and never happens: the two systems count
// sessions differently, Vercel drops more bots, and ad blockers hit them
// unequally. Only a gap big enough to change a decision is worth a word, so the
// thresholds are deliberately wide and named here rather than buried in a route.
const AGREEMENT = {
  MIN_SAMPLE: 20, // below this, ordinary variance looks like a fault
  LOW: 0.5,       // ours < half of theirs
  HIGH: 2,        // ours > double theirs
};

/**
 * @param {number} ours   distinct sessions our own beacon recorded
 * @param {number} theirs visitors Vercel recorded over the same window
 * @returns {{status: string, detail: string, advice?: string}}
 */
function agreementVerdict({ ours, theirs, days }) {
  if (ours === 0 && theirs === 0) {
    return {
      status: 'info',
      detail: `Neither tracker saw a visitor in ${days} days — they agree, but on nothing`,
      advice: 'Two trackers reporting zero is consistent, so this is most likely real: the shop needs traffic, not a fix here.',
    };
  }

  // The asymmetric case that matters most. Everything that makes decisions reads
  // OUR number, so if ours is silent while Vercel sees people, the funnel, the
  // advisor and every agent are confidently describing an empty shop.
  if (ours === 0 && theirs > 0) {
    return {
      status: 'critical',
      detail: `Vercel counted ${theirs} visitors in ${days} days and our own tracker counted none`,
      advice: 'Our beacon is broken, not the shop. The funnel, the advisor and every agent read OUR number, so they are all currently reporting an empty shop. Check /api/track/visit is reachable from the storefront and that lib/track.ts is not throwing.',
    };
  }

  const ratio = theirs > 0 ? ours / theirs : Infinity;
  if (theirs > AGREEMENT.MIN_SAMPLE && (ratio < AGREEMENT.LOW || ratio > AGREEMENT.HIGH)) {
    return {
      status: 'warning',
      detail: `Our tracker counted ${ours} visitors, Vercel counted ${theirs} (${days} days)`,
      advice: ratio < AGREEMENT.LOW
        ? 'Ours is losing roughly half the traffic Vercel sees — usually ad blockers, or the beacon failing on a route. Everything downstream (funnel, advisor) is reading the low number.'
        : 'Ours is counting far more than Vercel — likely bot traffic our filter misses, or sessions being split. Both inflate the top of the funnel and depress every conversion rate below it.',
    };
  }

  return {
    status: 'healthy',
    detail: `${ours} visitors ours · ${theirs} Vercel (${days} days) — close enough to trust`,
  };
}

function _resetCache() {
  cache = { data: null, at: 0 };
  lastAttemptAt = 0;
}

module.exports = { isConfigured, getTraffic, getTrafficCached, agreementVerdict, AGREEMENT, _resetCache };
