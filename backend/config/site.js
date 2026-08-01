'use strict';

// THE canonical storefront origin — one owner for the whole backend.
//
// Why: the URL was written 14 times across services in TWO different forms
// (with and without `www`), and a few places hardcoded it, ignoring
// FRONTEND_URL entirely. next.config.ts 301-redirects apex → www, so every
// non-www link cost an extra redirect hop — worst of all inside customer
// emails, where redirects hurt click-through and look sloppy — and the
// hardcoded ones meant a staging deploy would still link to production.
//
// Always import SITE_URL from here; never write the domain literally.
// Override per environment with FRONTEND_URL.

const DEFAULT_SITE = 'https://www.silkilinen.com';

function normalise(raw) {
  let url = String(raw || '').trim();
  if (!url) return DEFAULT_SITE;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  url = url.replace(/\/+$/, ''); // no trailing slash — callers append paths
  // Canonicalise the apex to www so we never link through the 301.
  url = url.replace(/^(https?:\/\/)silkilinen\.com/i, '$1www.silkilinen.com');
  return url;
}

const SITE_URL = normalise(process.env.FRONTEND_URL || DEFAULT_SITE);

/** Absolute URL for a storefront path: siteUrl('/shop') → https://www…/shop */
function siteUrl(path = '') {
  const p = String(path || '');
  if (!p) return SITE_URL;
  return `${SITE_URL}${p.startsWith('/') ? p : `/${p}`}`;
}

module.exports = { SITE_URL, siteUrl, DEFAULT_SITE };
