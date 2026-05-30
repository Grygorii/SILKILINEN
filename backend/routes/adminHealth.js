const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const { requireAuth } = require('../middleware/auth');
const PromoCode = require('../models/PromoCode');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

let healthCache = null;
let healthCacheAt = 0;
const CACHE_TTL = 60 * 60 * 1000;

async function timedFetch(url, options, ms = 5000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/**
 * Promo-coupon drift check. Stripe auto-deletes coupons after expiry, so an
 * active PromoCode in our DB can point at a Stripe coupon that's gone — the
 * code then silently fails at checkout. Verify up to 25 active codes that
 * carry a stripeCouponId and report how many no longer resolve.
 */
async function checkPromoCouponDrift() {
  const base = { name: 'promo_coupons', label: 'Promo codes (Stripe sync)' };
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return { ...base, status: 'healthy', detail: 'Stripe not configured — skipped' };
    }
    const codes = await PromoCode.find({
      status: 'active',
      stripeCouponId: { $exists: true, $nin: [null, ''] },
    }).select('code stripeCouponId').limit(25).lean();

    if (codes.length === 0) {
      return { ...base, status: 'healthy', detail: 'No active Stripe-linked codes' };
    }

    const results = await Promise.allSettled(codes.map(c =>
      timedFetch(`https://api.stripe.com/v1/coupons/${encodeURIComponent(c.stripeCouponId)}`, {
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
      }, 4000).then(r => ({ code: c.code, ok: r.ok, status: r.status }))
    ));

    const dead = results
      .map((r, i) => (r.status === 'fulfilled' && r.value.ok === false && r.value.status === 404) ? codes[i].code : null)
      .filter(Boolean);

    if (dead.length > 0) {
      return {
        ...base,
        status: 'warning',
        detail: `${dead.length} active code${dead.length > 1 ? 's' : ''} point at a deleted Stripe coupon: ${dead.slice(0, 5).join(', ')}${dead.length > 5 ? '…' : ''}`,
      };
    }
    return { ...base, status: 'healthy', detail: `${codes.length} active code${codes.length > 1 ? 's' : ''} verified` };
  } catch (err) {
    return { ...base, status: 'warning', detail: `Drift check failed: ${err.message}` };
  }
}

async function runChecks() {
  const results = await Promise.allSettled([
    Promise.resolve().then(() => ({
      name: 'mongodb',
      label: 'Database',
      status: mongoose.connection.readyState === 1 ? 'healthy' : 'critical',
      detail: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    })),

    cloudinary.api.ping()
      .then(() => ({ name: 'cloudinary', label: 'Media (Cloudinary)', status: 'healthy', detail: 'API responding' }))
      .catch(err => ({ name: 'cloudinary', label: 'Media (Cloudinary)', status: 'critical', detail: err.message || 'Failed' })),

    Promise.resolve().then(() => {
      const key = process.env.RESEND_API_KEY || '';
      const from = process.env.RESEND_FROM_EMAIL || '';
      if (!key) return { name: 'resend', label: 'Email (Resend)', status: 'critical', detail: 'RESEND_API_KEY is not set' };
      if (!key.startsWith('re_')) return { name: 'resend', label: 'Email (Resend)', status: 'critical', detail: 'RESEND_API_KEY has unexpected format' };
      if (!from) return { name: 'resend', label: 'Email (Resend)', status: 'critical', detail: 'RESEND_FROM_EMAIL is not set' };
      if (!/^[^@]+@[^@]+$/.test(from)) return { name: 'resend', label: 'Email (Resend)', status: 'critical', detail: 'RESEND_FROM_EMAIL is not a valid email' };
      return { name: 'resend', label: 'Email (Resend)', status: 'healthy', detail: 'Configuration valid' };
    }),

    timedFetch('https://api.stripe.com/v1/balance', {
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY || ''}` },
    }).then(r => ({
      name: 'stripe',
      label: 'Payments (Stripe)',
      status: r.ok ? 'healthy' : 'critical',
      detail: r.ok ? 'API responding' : `HTTP ${r.status}`,
    })).catch(err => ({
      name: 'stripe',
      label: 'Payments (Stripe)',
      status: 'critical',
      detail: err.name === 'AbortError' ? 'Timeout' : (err.message || 'Failed'),
    })),

    Promise.resolve().then(() => {
      const required = [
        'JWT_SECRET', 'MONGODB_URI', 'STRIPE_SECRET_KEY',
        'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET',
        'RESEND_API_KEY',
      ];
      const missing = required.filter(k => !process.env[k]);
      return {
        name: 'env',
        label: 'Environment',
        status: missing.length === 0 ? 'healthy' : 'critical',
        detail: missing.length === 0 ? 'All required vars set' : `Missing: ${missing.join(', ')}`,
      };
    }),

    checkPromoCouponDrift(),
  ]);

  const checks = results.map(r =>
    r.status === 'fulfilled'
      ? r.value
      : { name: 'unknown', label: 'Unknown', status: 'critical', detail: r.reason?.message || 'Error' }
  );

  const SEV = { healthy: 0, info: 1, warning: 2, critical: 3 };
  const overall = checks.reduce(
    (worst, c) => SEV[c.status] > SEV[worst] ? c.status : worst,
    'healthy'
  );

  return { overall, checks, checkedAt: new Date().toISOString() };
}

router.get('/', requireAuth, async (req, res) => {
  const now = Date.now();
  const force = req.query.force === 'true';
  if (!force && healthCache && now - healthCacheAt < CACHE_TTL) {
    return res.json({ ...healthCache, cached: true });
  }
  try {
    const result = await runChecks();
    healthCache = result;
    healthCacheAt = now;
    res.json({ ...result, cached: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
