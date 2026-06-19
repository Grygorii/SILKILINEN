'use strict';

// Google Search Console reader (OAuth, read-only).
//
// Search Console's "Add user" UI rejects service accounts on personal Gmail
// accounts, so this uses OAuth instead: the founder clicks "Allow" once, we
// store the refresh token, and the backend reads search data from then on.
//
// The Search Console API does NOT expose the bulk index-coverage report, but it
// does give the two things worth surfacing:
//   • sitemaps.list  → submitted URL count (Google deprecated the indexed count)
//   • searchanalytics.query → clicks / impressions / CTR / position + top
//     queries and pages (the live "is SEO working" data)
//
// Inert until GOOGLE_OAUTH_CLIENT_ID/SECRET + BACKEND_PUBLIC_URL + GSC_SITE_URL
// are set and a refresh token has been stored via the OAuth callback.

const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const SystemState = require('../models/SystemState');

const SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly'];
const REFRESH_KEY = 'gscRefreshToken';
const STATE_KEY = 'gscOAuthState';
const API_BASE = 'https://www.googleapis.com/webmasters/v3';

function redirectUri() {
  const base = (process.env.BACKEND_PUBLIC_URL || '').replace(/\/$/, '');
  return `${base}/api/admin/google/search-console/callback`;
}

function oauthConfigured() {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
    process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
    process.env.BACKEND_PUBLIC_URL &&
    process.env.GSC_SITE_URL
  );
}

function newClient() {
  return new OAuth2Client(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri()
  );
}

async function getRefreshToken() {
  const doc = await SystemState.findOne({ key: REFRESH_KEY }).lean();
  return doc?.value || null;
}

async function isConnected() {
  if (!oauthConfigured()) return false;
  return Boolean(await getRefreshToken());
}

// Build the consent URL and stash a one-time state nonce for CSRF protection.
async function generateAuthUrl() {
  const state = crypto.randomBytes(16).toString('hex');
  await SystemState.findOneAndUpdate(
    { key: STATE_KEY },
    { value: { state, at: Date.now() } },
    { upsert: true }
  );
  return newClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // force a refresh_token even on re-consent
    scope: SCOPES,
    state,
  });
}

async function handleCallback(code, state) {
  const saved = await SystemState.findOne({ key: STATE_KEY }).lean();
  if (!saved?.value?.state || saved.value.state !== state || Date.now() - saved.value.at > 10 * 60 * 1000) {
    throw new Error('Invalid or expired OAuth state');
  }
  const { tokens } = await newClient().getToken(code);
  if (!tokens.refresh_token) {
    throw new Error('Google returned no refresh token — remove the app under your Google account permissions and connect again.');
  }
  await SystemState.findOneAndUpdate({ key: REFRESH_KEY }, { value: tokens.refresh_token }, { upsert: true });
  await SystemState.deleteOne({ key: STATE_KEY });
}

async function disconnect() {
  await SystemState.deleteOne({ key: REFRESH_KEY });
}

async function accessToken() {
  const refresh = await getRefreshToken();
  if (!refresh) return null;
  const client = newClient();
  client.setCredentials({ refresh_token: refresh });
  const { token } = await client.getAccessToken();
  return token || null;
}

function siteSegment() {
  return encodeURIComponent(process.env.GSC_SITE_URL);
}

async function apiGet(path, timeoutMs = 8000) {
  const token = await accessToken();
  if (!token) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Search Console HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function apiPost(path, body, timeoutMs = 8000) {
  const token = await accessToken();
  if (!token) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Search Console HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// Submitted-URL count across all sitemaps (web content type).
//
// NOTE: Google deprecated the per-sitemap `contents.indexed` field — it now
// returns 0 for everyone, so it must NOT be surfaced as a real "indexed" count
// (the true figure lives in the Page indexing report, which the API doesn't
// expose). We still read `indexed` for backwards compatibility but the
// dashboard no longer displays it.
async function getSitemapsSummary() {
  const data = await apiGet(`sites/${siteSegment()}/sitemaps`);
  if (!data) return null;
  let submitted = 0, indexed = 0;
  for (const sm of data.sitemap || []) {
    for (const c of sm.contents || []) {
      submitted += Number(c.submitted) || 0;
      indexed += Number(c.indexed) || 0; // deprecated by Google — always 0
    }
  }
  return { sitemaps: (data.sitemap || []).length, submitted, indexed };
}

// GSC finalises data ~2 days back (its live UI shows fresher, still-revising
// figures up to "today"). End the window 2 days back: fresh enough to track the
// GSC dashboard closely, late enough that the numbers are stable, not wobbling.
function dateStr(daysAgo) {
  return new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
}

async function getSearchPerformance(days = 28) {
  const startDate = dateStr(days + 2);
  const endDate = dateStr(2);
  const base = { startDate, endDate };

  const [totals, byQuery, byPage] = await Promise.all([
    apiPost(`sites/${siteSegment()}/searchAnalytics/query`, base),
    apiPost(`sites/${siteSegment()}/searchAnalytics/query`, { ...base, dimensions: ['query'], rowLimit: 5 }),
    apiPost(`sites/${siteSegment()}/searchAnalytics/query`, { ...base, dimensions: ['page'], rowLimit: 5 }),
  ]);

  const t = totals?.rows?.[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  return {
    range: { startDate, endDate, days },
    totals: {
      clicks: Math.round(t.clicks || 0),
      impressions: Math.round(t.impressions || 0),
      ctr: t.ctr || 0,
      position: t.position || 0,
    },
    topQueries: (byQuery?.rows || []).map(r => ({ key: r.keys[0], clicks: Math.round(r.clicks || 0), impressions: Math.round(r.impressions || 0) })),
    topPages: (byPage?.rows || []).map(r => ({ key: r.keys[0], clicks: Math.round(r.clicks || 0), impressions: Math.round(r.impressions || 0) })),
  };
}

// Real queries the site already appears for, with position — the raw material
// for data-grounded content decisions (Growth Engine content writer). A query
// with impressions but a weak position is a topic Google already half-trusts
// the site on; content targeting it has a head start over topics invented
// from nothing.
async function getQueryOpportunities(days = 28) {
  const body = {
    startDate: dateStr(days + 2),
    endDate: dateStr(2),
    dimensions: ['query'],
    rowLimit: 25,
  };
  const data = await apiPost(`sites/${siteSegment()}/searchAnalytics/query`, body);
  return (data?.rows || []).map(r => ({
    query: r.keys[0],
    clicks: Math.round(r.clicks || 0),
    impressions: Math.round(r.impressions || 0),
    position: Math.round((r.position || 0) * 10) / 10,
  })).sort((a, b) => b.impressions - a.impressions);
}

// Query × PAGE pairs — which queries each page of the site ranks for. Powers
// cannibalisation detection (two pages competing for one query) and per-page
// outcome tracking. Returns [] on any failure.
async function getQueryPagePairs(days = 28) {
  try {
    const body = {
      startDate: dateStr(days + 2),
      endDate: dateStr(2),
      dimensions: ['query', 'page'],
      rowLimit: 250,
    };
    const data = await apiPost(`sites/${siteSegment()}/searchAnalytics/query`, body);
    return (data?.rows || []).map(r => ({
      query: r.keys[0],
      page: r.keys[1],
      clicks: Math.round(r.clicks || 0),
      impressions: Math.round(r.impressions || 0),
      position: Math.round((r.position || 0) * 10) / 10,
    }));
  } catch (err) {
    console.warn('[gsc] query-page pairs failed:', err.message);
    return [];
  }
}

// URL Inspection — is this URL actually indexed by Google? Uses the separate
// Search Console v1 endpoint (same OAuth scope). Returns null on any failure so
// callers degrade gracefully. { indexed, coverageState, verdict }.
async function inspectUrl(url) {
  const token = await accessToken();
  if (!token) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inspectionUrl: url, siteUrl: process.env.GSC_SITE_URL }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const idx = data?.inspectionResult?.indexStatusResult || {};
    return { indexed: idx.verdict === 'PASS', coverageState: idx.coverageState || 'unknown', verdict: idx.verdict || 'unknown' };
  } catch (err) {
    console.warn('[gsc] url inspection failed:', err.message);
    return null;
  } finally {
    clearTimeout(t);
  }
}

// Geographic breakdown — which countries Google actually shows the shop in.
// Strategic for a worldwide-shipping brand: impressions with no clicks in a
// market = a foothold to win; zero impressions = a market that hasn't found you.
// Returns ISO-3 country codes (gbr, usa, irl…) with clicks/impressions/position.
async function getCountryBreakdown(days = 28) {
  const res = await apiPost(`sites/${siteSegment()}/searchAnalytics/query`, {
    startDate: dateStr(days + 2),
    endDate: dateStr(2),
    dimensions: ['country'],
    rowLimit: 12,
  }).catch(() => null);
  return (res?.rows || []).map(r => ({
    country: r.keys[0],
    clicks: Math.round(r.clicks || 0),
    impressions: Math.round(r.impressions || 0),
    position: Math.round((r.position || 0) * 10) / 10,
  }));
}

// ISO-3 (GSC country codes) → 2-letter geo used by the demand/evidence lookups.
const ISO3_TO_2 = {
  gbr: 'GB', usa: 'US', irl: 'IE', aus: 'AU', can: 'CA', deu: 'DE', fra: 'FR', nld: 'NL',
  esp: 'ES', ita: 'IT', ind: 'IN', are: 'AE', sgp: 'SG', che: 'CH', swe: 'SE', nor: 'NO',
  dnk: 'DK', bel: 'BE', nzl: 'NZ', jpn: 'JP', hkg: 'HK', zaf: 'ZA',
};
// The brand's strongest market as a 2-letter geo (where Google shows the shop
// most), or null if Search Console isn't connected / has no country data yet.
// Shared so the Demand Scout and the Reasoning Clerk watch the SAME country.
async function getPrimaryMarket() {
  if (!(await isConnected().catch(() => false))) return null;
  const countries = await getCountryBreakdown(28).catch(() => []);
  const top = countries.filter(c => c.impressions > 0).sort((a, b) => b.impressions - a.impressions)[0];
  return top ? (ISO3_TO_2[String(top.country).toLowerCase()] || null) : null;
}

module.exports = {
  oauthConfigured,
  isConnected,
  generateAuthUrl,
  handleCallback,
  disconnect,
  getSitemapsSummary,
  getSearchPerformance,
  getCountryBreakdown,
  getPrimaryMarket,
  getQueryOpportunities,
  getQueryPagePairs,
  inspectUrl,
};
