const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const Visit = require('../models/Visit');

const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

// In-memory geo cache for the ipapi.co fallback path: ip → { data, at }.
// Vercel-header-based lookups don't touch this — they're free and
// instant per-request. The cache only matters when the proxy header
// path is unavailable (direct backend hits, dev, or Vercel header
// stripped). 24h TTL is fine for the fallback's hit rate.
const geoCache = new Map();
const GEO_TTL = 24 * 60 * 60 * 1000;

/**
 * Convert an ISO 3166-1 alpha-2 country code to its English display
 * name via the built-in Intl.DisplayNames. Works on Node 18+. Falls
 * back to the code itself if the lookup fails so we never end up with
 * a literal "undefined" in the DB.
 */
function countryNameFromCode(code) {
  if (!code) return null;
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'region' }).of(code);
    return name && name !== code ? name : null;
  } catch {
    return null;
  }
}

/**
 * Fallback path — only runs when the request didn't carry Vercel's
 * x-vercel-ip-* headers (i.e. direct hits to Railway, or local dev).
 * Hits ipapi.co with a 5s timeout (was 3s — slow responses were being
 * abandoned). When it fails, it WARNS so silent geo drops surface in
 * the Railway logs instead of disappearing.
 */
async function getGeoFromIpapi(ip) {
  if (!ip || ip === '::1' || ip === '127.0.0.1') return null;
  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.at < GEO_TTL) return cached.data;
  try {
    const res = await fetch(
      `https://ipapi.co/${ip}/json/`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) {
      console.warn(`[track] ipapi.co returned ${res.status} for ${ip}`);
      return null;
    }
    const json = await res.json();
    if (json.error) {
      console.warn(`[track] ipapi.co error for ${ip}: ${json.reason || 'unknown'}`);
      return null;
    }
    const data = {
      country:     json.country_name || null,
      countryCode: json.country_code || null,
      city:        json.city         || null,
      region:      json.region       || null,
    };
    geoCache.set(ip, { data, at: Date.now() });
    return data;
  } catch (err) {
    console.warn(`[track] ipapi.co fetch failed for ${ip}: ${err.message}`);
    return null;
  }
}

router.post('/visit', trackLimiter, async function(req, res) {
  // Always respond 200 — tracking never breaks the customer experience
  try {
    const { sessionId, page, productId, utm, referrer, device, source, geo: vercelGeo } = req.body;
    if (sessionId && page) {
      // Tier C: prefer Vercel's per-request geo headers (forwarded by
      // the Next.js proxy at frontend/app/api/track/visit). Instant,
      // free, no API call. Fall back to ipapi.co only when the proxy
      // didn't carry geo (direct backend hits / dev / rare missing
      // headers from Vercel edge).
      let geo = null;
      if (vercelGeo && (vercelGeo.countryCode || vercelGeo.city)) {
        geo = {
          country:     vercelGeo.country || countryNameFromCode(vercelGeo.countryCode),
          countryCode: vercelGeo.countryCode || null,
          city:        vercelGeo.city || null,
          region:      vercelGeo.region || null,
        };
      } else {
        geo = await getGeoFromIpapi(req.ip).catch(() => null);
      }

      if (!geo || (!geo.countryCode && !geo.city)) {
        // Last-ditch visibility — at this point the Visit will save with
        // no geo and silently drop out of the admin dashboard aggregations.
        console.warn(`[track] no geo resolved for sessionId=${sessionId} ip=${req.ip} pathname=${page}`);
      }

      // Tier B: store a sha256 hash of the IP (not the raw IP) for
      // future unique-visitor analytics that survives localStorage
      // clears. GDPR-friendly — the hash isn't reversible to a person
      // without the original IP + a dictionary attack on /24 ranges.
      const ipHash = req.ip
        ? crypto.createHash('sha256').update(req.ip).digest('hex')
        : null;

      await Visit.create({
        sessionId,
        page,
        productId: productId || undefined,
        source: source || 'direct',
        utm: utm || {},
        referrer: referrer || undefined,
        device: device || 'unknown',
        country:     geo?.country     || undefined,
        countryCode: geo?.countryCode || undefined,
        city:        geo?.city        || undefined,
        region:      geo?.region      || undefined,
        ipHash:      ipHash           || undefined,
      });
    }
  } catch (err) {
    console.error('[track] visit error:', err.message);
  }
  res.json({ ok: true });
});

module.exports = router;
