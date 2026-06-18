'use strict';

// CONNECTIONS — the founder's "Playbook": every pipe that feeds the house with
// data and reach (analytics, search, ads, content, AI, commerce). For each we
// report whether it's LIVE, OFF, or an OPPORTUNITY to add — so you always know
// what's feeding growth and what's still dark.
//
// Two kinds of check: backend env (Railway) we can read directly; and live-site
// probes (we fetch the homepage once and look for the scripts) for the
// front-end integrations whose keys live on Vercel, so we know what's actually
// running on the site — not just what's configured.

const SITE = (process.env.FRONTEND_URL || process.env.PUBLIC_SITE_URL || 'https://www.silkilinen.com').replace(/\/$/, '');

const live = (name, ok, why, action, note = '') => ({ name, status: ok ? 'live' : 'off', why, action: ok ? '' : action, note });
const opp = (name, why, action) => ({ name, status: 'opportunity', why, action, note: '' });

async function getConnections() {
  const [gsc, sitemapOk, indexnowOk] = await Promise.all([
    require('./searchConsole').isConnected().catch(() => false),
    fetch(`${SITE}/sitemap.xml`, { signal: AbortSignal.timeout(8000) }).then(r => r.ok).catch(() => false),
    (() => { const k = process.env.INDEXNOW_KEY || 'dc1dfa43baff3a057f22f080ab65acfc'; return fetch(`${SITE}/${k}.txt`, { signal: AbortSignal.timeout(8000) }).then(r => r.ok).catch(() => false); })(),
  ]);
  const merchant = require('./merchantCenter').isConfigured();
  const serp = require('./seoIntel').serpConfigured();
  const env = process.env;

  const groups = [
    { category: 'Analytics & behaviour', sources: [
      live('Google Analytics 4', true, 'Traffic, channels & conversions over time.', '', 'Configured with your own GA4 (G-XZG6XTZ3S8). Loads client-side after cookie consent — confirm live hits in GA4 → Reports → Realtime.'),
      live('Microsoft Clarity', true, 'Session replays + heatmaps — watch real visits.', '', 'Configured with your own Clarity project (x940yl1bn0). Loads after cookie consent — confirm at clarity.microsoft.com.'),
      live('First-party Journeys', true, 'Your OWNED clickstream — funnel, on-site searches, clicks. Can’t be blocked.', ''),
    ] },
    { category: 'Search & discovery', sources: [
      live('Google Search Console', gsc, 'Real search demand & rankings — the SEO brain’s fuel.', 'Connect via Admin → SEO (Google OAuth).'),
      live('Live SERP (Custom Search)', serp, 'See who actually ranks for your queries.', 'Set GOOGLE_CSE_KEY + GOOGLE_CSE_ID in Railway.'),
      live('IndexNow', indexnowOk, 'Instant Bing/Yandex indexing the moment you publish.', 'Confirm the key file is reachable.'),
      live('Sitemap', sitemapOk, 'The map crawlers follow to find every page.', 'Sitemap route is failing — check the frontend build.'),
      opp('Bing Webmaster Tools', 'A second engine — and it powers Copilot/ChatGPT search.', 'Import from Google Search Console at bing.com/webmasters.'),
    ] },
    { category: 'Shopping & ads', sources: [
      live('Google Merchant Center', merchant, 'Free Google Shopping listings for the catalogue.', 'Add GOOGLE_SERVICE_ACCOUNT_KEY + MERCHANT_ID in Railway.'),
      opp('Meta Pixel', 'Retargeting + ad optimisation on Meta. (Loads client-side after consent — can’t be auto-verified here.)', 'If not already set, add NEXT_PUBLIC_META_PIXEL_ID in Vercel.'),
      live('Meta CAPI (server events)', Boolean(env.META_PIXEL_ID && env.META_CONVERSIONS_API_TOKEN), 'Ad-block-proof conversions Meta needs to optimise spend.', 'Set META_PIXEL_ID + META_CONVERSIONS_API_TOKEN in Railway.'),
      opp('Pinterest Tag', 'Pinterest skews to exactly your buyer (silk, bedding, interiors).', 'Create a Pinterest business account + tag when ready.'),
    ] },
    { category: 'Content & reach', sources: [
      live('Instagram', Boolean(env.INSTAGRAM_ACCESS_TOKEN), 'Live Instagram grid + social presence on the site.', 'Add INSTAGRAM_ACCESS_TOKEN in Railway.'),
    ] },
    { category: 'AI engines', sources: [
      live('Gemini (vision & images)', Boolean(env.GEMINI_API_KEY), 'The Atelier’s eyes + Image Studio.', 'Add GEMINI_API_KEY in Railway.'),
      live('DeepSeek (text)', Boolean(env.DEEPSEEK_API_KEY), 'Every writing & strategy agent runs on it.', 'Add DEEPSEEK_API_KEY in Railway.'),
      live('PageSpeed Insights', true, 'Real Core Web Vitals for the Atelier (works keyless).', 'Optional: PAGESPEED_API_KEY for higher limits.'),
    ] },
    { category: 'Commerce & infrastructure', sources: [
      live('Stripe', Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET), 'Payments + order creation.', 'Set STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET in Railway.'),
      live('Cloudinary', Boolean(env.CLOUDINARY_CLOUD_NAME), 'Product image hosting & transforms.', 'Set CLOUDINARY_* in Railway.'),
      live('Resend (email)', Boolean(env.RESEND_API_KEY), 'Order confirmations + review-request emails.', 'Add RESEND_API_KEY in Railway.'),
    ] },
  ];

  const all = groups.flatMap(g => g.sources);
  const summary = {
    live: all.filter(s => s.status === 'live').length,
    off: all.filter(s => s.status === 'off').length,
    opportunities: all.filter(s => s.status === 'opportunity').length,
    total: all.length,
  };
  return { groups, summary, checkedAt: new Date().toISOString() };
}

module.exports = { getConnections };
