const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const gsc = require('../services/searchConsole');

// Search Console OAuth + read endpoints.
// Mounted at /api/admin/google/search-console.

// Where to send the admin's browser back to after the OAuth round-trip.
function adminUrl() {
  const base = (process.env.ADMIN_URL || process.env.PUBLIC_SITE_URL || 'https://www.silkilinen.com').replace(/\/$/, '');
  return `${base}/admin`;
}

// Is OAuth configured, and are we connected yet?
router.get('/status', requireAuth, async (req, res) => {
  try {
    res.json({ configured: gsc.oauthConfigured(), connected: await gsc.isConnected() });
  } catch (err) {
    console.error('[gsc] status', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Kick off the consent flow (top-level navigation from the admin UI).
router.get('/connect', requireAuth, async (req, res) => {
  try {
    if (!gsc.oauthConfigured()) {
      return res.redirect(`${adminUrl()}?gsc=unconfigured`);
    }
    res.redirect(await gsc.generateAuthUrl());
  } catch (err) {
    console.error('[gsc] connect', err);
    res.redirect(`${adminUrl()}?gsc=error`);
  }
});

// Google redirects here. Public (Google can't send our auth cookie reliably),
// but protected by the one-time state nonce validated in handleCallback.
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect(`${adminUrl()}?gsc=denied`);
  if (!code || !state) return res.redirect(`${adminUrl()}?gsc=error`);
  try {
    await gsc.handleCallback(String(code), String(state));
    res.redirect(`${adminUrl()}?gsc=connected`);
  } catch (err) {
    console.error('[gsc] callback', err.message);
    res.redirect(`${adminUrl()}?gsc=error`);
  }
});

router.post('/disconnect', requireAuth, async (req, res) => {
  try {
    await gsc.disconnect();
    res.json({ ok: true });
  } catch (err) {
    console.error('[gsc] disconnect', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Live data for the dashboard panel.
router.get('/performance', requireAuth, async (req, res) => {
  try {
    if (!(await gsc.isConnected())) {
      return res.json({ configured: gsc.oauthConfigured(), connected: false });
    }
    const [sitemaps, performance, countries] = await Promise.all([
      gsc.getSitemapsSummary().catch(() => null),
      gsc.getSearchPerformance().catch(() => null),
      gsc.getCountryBreakdown().catch(() => []),
    ]);
    res.json({ configured: true, connected: true, sitemaps, performance, countries });
  } catch (err) {
    console.error('[gsc] performance', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
