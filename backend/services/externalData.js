'use strict';

// External-data layer — the Growth Engine's senses OUTSIDE the shop. These
// hit the live internet, so they run on Railway (open egress), not in the
// build sandbox. Every call is time-boxed and fails soft: on any error the
// caller gets an empty result and the engine carries on. Parsing is verified
// against captured response samples in test/externalData.test (the live fetch
// proves out on deploy).

const DEFAULT_TIMEOUT = 8000;
const UA = 'Mozilla/5.0 (compatible; SilkilinenGrowth/1.0; +https://www.silkilinen.com)';

async function getJson(url, { timeout = DEFAULT_TIMEOUT, headers = {} } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function getText(url, { timeout = DEFAULT_TIMEOUT, headers = {} } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

// ── Google Autocomplete ─────────────────────────────────────────────────────
// The single most reliable read on real public search demand: what Google
// actually suggests as people type. Endpoint returns ["term", ["sugg", ...]].
// `parseAutocomplete` is pure so it can be unit-tested without the network.
function parseAutocomplete(payload) {
  if (!Array.isArray(payload) || !Array.isArray(payload[1])) return [];
  return payload[1]
    .map(s => (typeof s === 'string' ? s : Array.isArray(s) ? s[0] : ''))
    .filter(Boolean);
}

async function googleAutocomplete(term, geo = 'IE') {
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=${encodeURIComponent(geo)}&q=${encodeURIComponent(term)}`;
    const data = await getJson(url, { timeout: 6000 });
    return parseAutocomplete(data);
  } catch (err) {
    console.warn(`[external] autocomplete "${term}" failed: ${err.message}`);
    return [];
  }
}

// Expand a seed term into the real search phrases around it — the bare seed
// plus "<seed> a..z" probes surface the long tail Google sees demand for.
async function expandDemand(seed, geo = 'IE') {
  const probes = ['', ...'abcdefghijklmnopqrstuvw'.split('').map(c => ` ${c}`)];
  const seen = new Set();
  // Cap concurrency so we don't hammer the endpoint into a rate-limit.
  for (let i = 0; i < probes.length; i += 6) {
    const batch = probes.slice(i, i + 6).map(p => googleAutocomplete(`${seed}${p}`, geo));
    const results = await Promise.all(batch);
    for (const list of results) for (const s of list) seen.add(s.toLowerCase().trim());
    if (seen.size > 60) break;
  }
  // Drop the seed itself and obvious dupes; keep multi-word, intent-bearing phrases.
  return [...seen].filter(p => p && p !== seed.toLowerCase() && p.split(' ').length >= 2).slice(0, 40);
}

// ── Google Trends (best-effort enrichment) ──────────────────────────────────
// The two-step explore → multiline dance, used only to add a rising/falling
// read. Brittle and rate-limited by design, so it is STRICTLY optional: any
// failure returns null and the demand read proceeds on autocomplete alone.
function stripGooglePrefix(text) {
  // Trends responses are prefixed with ")]}'," / ")]}'\n" garbage.
  const i = text.indexOf('{');
  const j = text.indexOf('[');
  const start = Math.min(...[i, j].filter(n => n >= 0));
  return start >= 0 ? text.slice(start) : text;
}

async function googleTrendsInterest(term, geo = 'IE') {
  try {
    const reqExplore = {
      comparisonItem: [{ keyword: term, geo, time: 'today 12-m' }],
      category: 0,
      property: '',
    };
    const exploreUrl = `https://trends.google.com/trends/api/explore?hl=en-US&tz=0&req=${encodeURIComponent(JSON.stringify(reqExplore))}`;
    const exploreRaw = await getText(exploreUrl, { timeout: 7000 });
    const explore = JSON.parse(stripGooglePrefix(exploreRaw));
    const widget = (explore.widgets || []).find(w => w.id === 'TIMESERIES');
    if (!widget) return null;

    const dataUrl = `https://trends.google.com/trends/api/widgetdata/multiline?hl=en-US&tz=0&req=${encodeURIComponent(JSON.stringify(widget.request))}&token=${encodeURIComponent(widget.token)}`;
    const dataRaw = await getText(dataUrl, { timeout: 7000 });
    const series = JSON.parse(stripGooglePrefix(dataRaw));
    return summariseTrend(series, term);
  } catch (err) {
    console.warn(`[external] trends "${term}" skipped: ${err.message}`);
    return null;
  }
}

// Pure: turn a multiline timeline into a recent-vs-earlier verdict.
function summariseTrend(series, term) {
  const points = (series?.default?.timelineData || [])
    .map(d => (Array.isArray(d.value) ? d.value[0] : 0))
    .filter(v => typeof v === 'number');
  if (points.length < 8) return null;
  const recent = points.slice(-4);
  const earlier = points.slice(-12, -4);
  const avg = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
  const r = avg(recent), e = avg(earlier);
  const changePct = e > 0 ? Math.round(((r - e) / e) * 100) : null;
  const direction = changePct == null ? 'flat' : changePct >= 20 ? 'rising' : changePct <= -20 ? 'falling' : 'steady';
  return { term, recentInterest: Math.round(r), changePct, direction };
}

// ── Live competitor page read ───────────────────────────────────────────────
// Fetch a competitor page NOW and reduce it to readable text, so the scout
// reasons about what they are ACTUALLY doing today, not a stale memory.
function htmlToText(html, maxChars = 6000) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars);
}

async function fetchReadablePage(url, maxChars = 6000) {
  try {
    const html = await getText(url.startsWith('http') ? url : `https://${url}`, { timeout: 9000 });
    return htmlToText(html, maxChars);
  } catch (err) {
    console.warn(`[external] page fetch "${url}" failed: ${err.message}`);
    return '';
  }
}

module.exports = {
  googleAutocomplete,
  expandDemand,
  googleTrendsInterest,
  fetchReadablePage,
  // exported for unit tests:
  parseAutocomplete,
  summariseTrend,
  stripGooglePrefix,
  htmlToText,
};
