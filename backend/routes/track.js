const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const Visit = require('../models/Visit');

const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

// In-memory geo cache: ip → { data, at } — avoids hammering ip-api.com
const geoCache = new Map();
const GEO_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function getGeo(ip) {
  if (!ip || ip === '::1' || ip === '127.0.0.1') return null;
  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.at < GEO_TTL) return cached.data;
  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city`,
      { signal: AbortSignal.timeout(3000) },
    );
    const json = await res.json();
    if (json.status !== 'success') return null;
    const data = {
      country:     json.country     || null,
      countryCode: json.countryCode || null,
      city:        json.city        || null,
      region:      json.regionName  || null,
    };
    geoCache.set(ip, { data, at: Date.now() });
    return data;
  } catch {
    return null;
  }
}

router.post('/visit', trackLimiter, async function(req, res) {
  // Always respond 200 — tracking never breaks the customer experience
  try {
    const { sessionId, page, productId, utm, referrer, device, source } = req.body;
    if (sessionId && page) {
      const geo = await getGeo(req.ip).catch(() => null);
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
      });
    }
  } catch (err) {
    console.error('[track] visit error:', err.message);
  }
  res.json({ ok: true });
});

module.exports = router;
