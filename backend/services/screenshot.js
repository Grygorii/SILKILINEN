'use strict';

// Full-page rendered SCREENSHOT of any public URL, so the Atelier sees the real
// room a visitor walks into — the rendered layout, not just the raw imagery.
//
// Default source: WordPress mShots (s.wordpress.com/mshots) — free, no key, it
// renders the page server-side and returns a JPEG. It renders asynchronously, so
// the first hit often returns a small placeholder; we retry until a real frame
// comes back. Override with SCREENSHOT_URL_TEMPLATE (a paid provider, using
// {url} and {w} placeholders) for higher reliability. Returns inline base64 for
// the vision model, or null (the caller then degrades to content-based review).

const DEFAULT_TPL = 'https://s.wordpress.com/mshots/v1/{url}?w={w}';

function buildUrl(target, w, bust) {
  const tpl = process.env.SCREENSHOT_URL_TEMPLATE || DEFAULT_TPL;
  let url = tpl.replace('{url}', encodeURIComponent(target)).replace('{w}', String(w));
  // mShots caches a rendered frame by URL forever — so after a deploy the Atelier
  // would keep grading an OLD screenshot. A rotating `vhash` forces a fresh render
  // each bucket, so reviews reflect what's actually live.
  if (bust) url += (url.includes('?') ? '&' : '?') + 'vhash=' + encodeURIComponent(bust);
  return url;
}

async function capture(target, { width = 1280, retries, waitMs, bust = '' } = {}) {
  // A busted URL renders cold on first hit, so give mShots more patience.
  if (retries == null) retries = bust ? 7 : 4;
  if (waitMs == null) waitMs = bust ? 6000 : 4500;
  const url = buildUrl(target, width, bust);
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000) });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        // mShots' "still rendering" placeholder is tiny; a real screenshot is
        // tens to hundreds of KB. Treat >14KB as a real frame.
        if (buf.length > 14000) {
          return { mimeType: res.headers.get('content-type') || 'image/jpeg', data: buf.toString('base64'), bytes: buf.length };
        }
      }
    } catch { /* transient — retry */ }
    if (i < retries - 1) await new Promise(r => setTimeout(r, waitMs));
  }
  return null;
}

module.exports = { capture };
