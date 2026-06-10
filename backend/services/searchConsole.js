'use strict';

// Google Search Console reader (OAuth, read-only).
//
// Search Console's "Add user" UI rejects service accounts on personal Gmail
// accounts, so this uses OAuth instead: the founder clicks "Allow" once, we
// store the refresh token, and the backend reads search data from then on.
//
// The Search Console API does NOT expose the bulk index-coverage report, but it
// does give the two things worth surfacing:
//   • sitemaps.list  → submitted vs indexed URL counts
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

// Submitted vs indexed across all sitemaps (web content type).
async function getSitemapsSummary() {
  const data = await apiGet(`sites/${siteSegment()}/sitemaps`);
  if (!data) return null;
  let submitted = 0, indexed = 0;
  for (const sm of data.sitemap || []) {
    for (const c of sm.contents || []) {
      submitted += Number(c.submitted) || 0;
      indexed += Number(c.indexed) || 0;
    }
  }
  return { sitemaps: (data.sitemap || []).length, submitted, indexed };
}

// GSC data lags ~2-3 days; end the window a few days back so it isn't empty.
function dateStr(daysAgo) {
  return new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
}

async function getSearchPerformance(days = 28) {
  const startDate = dateStr(days + 3);
  const endDate = dateStr(3);
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

module.exports = {
  oauthConfigured,
  isConnected,
  generateAuthUrl,
  handleCallback,
  disconnect,
  getSitemapsSummary,
  getSearchPerformance,
};
