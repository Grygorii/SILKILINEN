const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const Product = require('../models/Product');
const { isConfigured: merchantConfigured, getProductIssues } = require('../services/merchantCenter');
const { getTrafficCached, agreementVerdict } = require('../services/vercelAnalytics');

// Honest SEO / Merchant health. The existing /api/admin/health checks
// infrastructure (DB, Stripe, Cloudinary…) — it is green whenever the
// servers are up. That is why the dashboard showed "all good" while
// Google Search Console and Merchant Center reported real problems: nothing
// here ever looked at the public site or the catalogue from Google's angle.
//
// These checks use no external credentials — they probe the live public
// URLs and read the catalogue out of Mongo. When the Search Console /
// Merchant Center APIs are wired up later, their live verdicts slot in as
// additional checks alongside these. Each check carries an `advice` line so
// the panel tells the founder what to actually do, not just that something
// is wrong.

const SITE = (process.env.PUBLIC_SITE_URL || 'https://www.silkilinen.com').replace(/\/$/, '');
const APEX = SITE.replace('://www.', '://');

let cache = null;
let cacheAt = 0;
const CACHE_TTL = 60 * 60 * 1000;

async function timedFetch(url, options = {}, ms = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

// Apex (silkilinen.com) must 301/308 to the www canonical host. A bare apex
// that serves 200 (or 5xx) gives Google two competing hosts to index.
async function checkApexRedirect() {
  const base = { name: 'apex_redirect', label: 'Apex → www redirect' };
  if (APEX === SITE) {
    return { ...base, status: 'info', detail: 'Canonical host is not a www host — apex check skipped' };
  }
  try {
    const res = await timedFetch(`${APEX}/`, { redirect: 'manual' });
    const loc = res.headers.get('location') || '';
    if ([301, 308].includes(res.status) && loc.includes('www.')) {
      return { ...base, status: 'healthy', detail: `${res.status} → ${loc}` };
    }
    return {
      ...base,
      status: 'critical',
      detail: `Apex returned ${res.status}${loc ? ` → ${loc}` : ' (no redirect)'}`,
      advice: 'In Vercel → Domains, set the bare apex (silkilinen.com) to redirect to www.silkilinen.com.',
    };
  } catch (err) {
    return { ...base, status: 'warning', detail: `Could not reach apex: ${err.message}` };
  }
}

async function checkSitemap() {
  const base = { name: 'sitemap', label: 'Sitemap' };
  try {
    const res = await timedFetch(`${SITE}/sitemap.xml`);
    if (!res.ok) {
      return { ...base, status: 'critical', detail: `HTTP ${res.status}`, advice: 'Sitemap route is failing — check the frontend /sitemap.xml build.' };
    }
    const body = await res.text();
    const count = (body.match(/<url>/g) || []).length;
    if (count === 0) {
      return { ...base, status: 'warning', detail: 'Reachable but contains 0 URLs', advice: 'Product fetch in sitemap.ts is likely failing — verify NEXT_PUBLIC_API_URL.' };
    }
    return { ...base, status: 'healthy', detail: `${count} URLs listed` };
  } catch (err) {
    return { ...base, status: 'warning', detail: `Could not fetch: ${err.message}` };
  }
}

async function checkMerchantFeed() {
  const base = { name: 'merchant_feed', label: 'Merchant feed' };
  try {
    const res = await timedFetch(`${SITE}/feed/google.xml`);
    if (res.status === 503) {
      return { ...base, status: 'critical', detail: 'Feed returned 503 (backend unreachable at fetch time)', advice: 'Merchant Center will keep the last good fetch, but fix the backend products API.' };
    }
    if (!res.ok) {
      return { ...base, status: 'critical', detail: `HTTP ${res.status}`, advice: 'Merchant feed route is failing.' };
    }
    const body = await res.text();
    const count = (body.match(/<item>/g) || []).length;
    if (count === 0) {
      return { ...base, status: 'warning', detail: 'Reachable but 0 items', advice: 'No sellable products in the feed — check product status/stock.' };
    }
    // itemCount is read by the Merchant Center tile: its own total is what
    // GOOGLE holds, and the two silently disagreeing is the failure that
    // matters most here.
    // Remember the count and compare with the last look. Google emailed about
    // active items falling 24 -> 14 hours after the catalogue was re-slugged;
    // nothing on our side had noticed, because every check only ever asked
    // "is the feed reachable RIGHT NOW". A feed can be perfectly healthy and
    // still have lost a third of its items since yesterday.
    const SystemState = require('../models/SystemState');
    const KEY = 'merchantFeedLastCount';
    let drop = null;
    try {
      const prev = await SystemState.findOne({ key: KEY }).lean();
      const before = Number(prev?.value?.count);
      if (Number.isFinite(before) && before > 0 && count < before * 0.8) {
        drop = { before, after: count, pct: Math.round((1 - count / before) * 100) };
      }
      await SystemState.findOneAndUpdate(
        { key: KEY },
        { $set: { key: KEY, value: { count, at: new Date().toISOString() } } },
        { upsert: true },
      );
    } catch { /* history is a nice-to-have; never fail the check over it */ }

    if (drop) {
      return {
        ...base,
        status: 'warning',
        detail: `${count} items — down ${drop.pct}% from ${drop.before} since the last check`,
        advice: 'A fall this size usually follows a catalogue change: renamed products, re-slugged URLs, or items going out of stock. Check Merchant Center → Diagnostics. If URLs changed, the dip recovers as Google re-verifies each new landing page.',
        itemCount: count,
      };
    }

    return { ...base, status: 'healthy', detail: `${count} items`, itemCount: count };
  } catch (err) {
    return { ...base, status: 'warning', detail: `Could not fetch: ${err.message}` };
  }
}

async function checkHomepageCanonical() {
  const base = { name: 'homepage_canonical', label: 'Homepage canonical tag' };
  try {
    const res = await timedFetch(`${SITE}/`);
    if (!res.ok) return { ...base, status: 'warning', detail: `Homepage returned HTTP ${res.status}` };
    const body = await res.text();
    if (/rel=["']canonical["']/i.test(body)) {
      return { ...base, status: 'healthy', detail: 'Canonical present' };
    }
    return { ...base, status: 'warning', detail: 'No canonical tag found', advice: 'Set alternates.canonical in the homepage metadata.' };
  } catch (err) {
    return { ...base, status: 'warning', detail: `Could not fetch: ${err.message}` };
  }
}

// Read the live catalogue and report how many active products are missing
// the fields that cause Merchant disapprovals or weak search snippets.
async function checkCatalogue() {
  const merchant = { name: 'catalogue_merchant', label: 'Catalogue — Merchant readiness' };
  const seo = { name: 'catalogue_seo', label: 'Catalogue — SEO meta' };
  try {
    const products = await Product.find({ status: { $in: ['active', 'sold_out'] } })
      .select('name description category metaTitle metaDescription images image price')
      .lean();

    if (products.length === 0) {
      return [
        { ...merchant, status: 'info', detail: 'No active products' },
        { ...seo, status: 'info', detail: 'No active products' },
      ];
    }

    const hasImage = p => (Array.isArray(p.images) && p.images.some(i => i && i.url)) || Boolean(p.image);
    const noImage = products.filter(p => !hasImage(p));
    const noDesc = products.filter(p => !p.description || p.description.trim().length < 20);
    const noCategory = products.filter(p => !p.category || !String(p.category).trim());
    const noMeta = products.filter(p => !p.metaTitle || !p.metaDescription);

    const merchantIssues = [];
    if (noImage.length) merchantIssues.push(`${noImage.length} without an image`);
    if (noDesc.length) merchantIssues.push(`${noDesc.length} with thin/missing description`);
    if (noCategory.length) merchantIssues.push(`${noCategory.length} without a category`);

    const merchantCheck = merchantIssues.length
      ? {
          ...merchant,
          status: noImage.length ? 'critical' : 'warning',
          detail: `${products.length} active · ${merchantIssues.join(', ')}`,
          advice: 'Products without an image or description get disapproved by Merchant Center. Fix them in the product editor.',
        }
      : { ...merchant, status: 'healthy', detail: `${products.length} active products feed-ready` };

    const seoCheck = noMeta.length
      ? {
          ...seo,
          status: 'warning',
          detail: `${noMeta.length}/${products.length} missing meta title or description`,
          advice: 'Add metaTitle (≤70 chars) and metaDescription (≤165) per product for stronger search snippets.',
        }
      : { ...seo, status: 'healthy', detail: 'All active products have meta title + description' };

    return [merchantCheck, seoCheck];
  } catch (err) {
    return [
      { ...merchant, status: 'warning', detail: `Catalogue read failed: ${err.message}` },
      { ...seo, status: 'warning', detail: `Catalogue read failed: ${err.message}` },
    ];
  }
}

// Live Merchant Center verdict — the exact reason products are disapproved,
// straight from Google. Inert (info) until the service account + MERCHANT_ID
// are configured in Railway, so it never breaks the panel during setup.
async function checkMerchantLive(feedItemCount = null) {
  const base = { name: 'merchant_live', label: 'Merchant Center — live status' };
  if (!merchantConfigured()) {
    return {
      ...base,
      status: 'info',
      detail: 'Not connected yet',
      advice: 'Add GOOGLE_SERVICE_ACCOUNT_KEY + MERCHANT_ID in Railway (see docs/google-api-setup.md) to show live product approvals here.',
    };
  }
  try {
    const data = await getProductIssues();
    if (!data.configured) {
      return { ...base, status: 'warning', detail: 'Credentials present but Google auth failed', advice: 'Re-check the service-account key and that the robot is a user in Merchant Center.' };
    }
    const { total, approved, pending, disapproved, issues } = data;
    if (disapproved > 0) {
      // Prefer issues Google flags as outright disapproving, but fall back to
      // the highest-count issues if none carry that exact servability — Google
      // sometimes reports the blocker under 'demoted'/unset, and showing the
      // real reason matters more than the label. Without this fallback the card
      // degrades to a bare doc link with no human-readable cause.
      const disapprovingFirst = issues.filter(i => i.servability === 'disapproved');
      const shown = (disapprovingFirst.length ? disapprovingFirst : issues).slice(0, 3);
      const top = shown.map(i => `${i.description || i.code} (${i.count})`).join('; ');
      const doc = shown[0]?.documentation || issues[0]?.documentation;
      return {
        ...base,
        status: 'critical',
        detail: `${disapproved}/${total} products disapproved.${top ? ` Top: ${top}` : ''}`,
        advice: doc
          ? `Fix the top issue — Google's guide: ${doc}`
          : 'Open Merchant Center → Products → Diagnostics for the full list.',
      };
    }
    if (pending > 0) {
      return { ...base, status: 'warning', detail: `${approved} approved · ${pending} pending review · ${total} total` };
    }
    // Approved everywhere, but item-level issues (missing colour, image type,
    // adult-content flags…) can still hold a product back from Shopping ads /
    // full distribution. Surface those as a WARNING, not a false "all good" —
    // and never as critical, since the products are live.
    // Google's `total` is what Merchant Center actually HOLDS. The feed's item
    // count is what we currently publish. When those diverge materially, Google
    // is working from an older fetch — and every tile can read "healthy" while
    // most of the catalogue is invisible to Shopping. Nothing was comparing
    // them, so a stale feed looked exactly like a healthy one.
    if (feedItemCount != null && total > 0 && feedItemCount > total * 1.25) {
      return {
        ...base,
        status: 'warning',
        detail: `Google holds ${total} items, the feed publishes ${feedItemCount}. ${approved}/${total} of what Google has is approved.`,
        advice: 'Merchant Center is working from an older fetch. Check Merchant Center → Products → Feeds for the last fetch time and schedule, then re-fetch. The feed emits one item per VARIANT, so the counts are expected to differ from the product count — but not by this much.',
      };
    }

    const limiting = issues.filter(i => i.servability === 'disapproved' || i.servability === 'demoted');
    if (limiting.length) {
      const affected = limiting.reduce((s, i) => s + (i.count || 0), 0);
      const top = limiting.slice(0, 3).map(i => `${i.description || i.code} (${i.count})`).join('; ');
      return {
        ...base,
        status: 'warning',
        detail: `${approved}/${total} approved · ${affected} item issue(s) limiting ad reach. Top: ${top}`,
        advice: limiting[0]?.documentation
          ? `Approved for free listings, but fix these for Shopping ads — Google's guide: ${limiting[0].documentation}`
          : 'Approved for free listings; fix these item issues in the product editor for full Shopping-ads eligibility.',
      };
    }
    return { ...base, status: 'healthy', detail: `${approved}/${total} products approved` };
  } catch (err) {
    return { ...base, status: 'warning', detail: `Merchant API error: ${err.message}` };
  }
}

// Live SERP (Google Custom Search) — verifies the key actually works AND that
// the engine searches the whole web (no results usually means "Search the
// entire web" is still off). Powers Hermes' SERP analysis.
async function checkSerp() {
  const base = { name: 'serp', label: 'Live SERP (Custom Search)' };
  const { serpConfigured, serpAnalysis } = require('../services/seoIntel');
  if (!serpConfigured()) {
    return { ...base, status: 'info', detail: 'Not connected', advice: 'Set GOOGLE_CSE_KEY + GOOGLE_CSE_ID in Railway so Hermes can read the live Google SERP.' };
  }
  try {
    const r = await serpAnalysis('silk robe');
    if (r.error) return { ...base, status: 'warning', detail: `Configured but the API errored: ${r.error}`, advice: 'Check the API key and that the Custom Search API is enabled in Google Cloud.' };
    if (!r.results.length) return { ...base, status: 'warning', detail: 'Configured but returned no results', advice: 'In your Programmable Search Engine settings, turn ON "Search the entire web".' };
    return { ...base, status: 'healthy', detail: `Connected — ${r.results.length} live results for a test query. Hermes can analyse the SERP.` };
  } catch (err) {
    return { ...base, status: 'warning', detail: `Check failed: ${err.message}` };
  }
}

// Do our two trackers agree about how many people came?
//
// The shop counts visitors twice: our own beacon (lib/track.ts -> Visit, which
// feeds the funnel, the advisor and every agent) and Vercel Analytics. Only our
// beacon drives decisions, and it is the more fragile of the two — it is our own
// JavaScript posting to our own API, so an ad blocker, a bad deploy or one
// thrown exception silences it. A silenced beacon looks exactly like a quiet
// shop, and the funnel would report "nobody arrived" with total confidence.
//
// Vercel's count is the second opinion that makes the first one checkable. This
// check exists to answer one question: if they disagree badly, which one is
// wrong? It lives in this panel because this is where the shop's other
// two-systems-disagree check already lives (what the feed publishes vs what
// Google holds) — same failure shape, same place to look.
async function checkAnalyticsAgreement({ force = false } = {}) {
  const base = { name: 'analytics_agreement', label: 'Visitor counts agree' };
  const DAYS = 14;

  const traffic = await getTrafficCached({ days: DAYS, force }).catch(err => ({ configured: true, error: err.message }));

  if (!traffic.configured) {
    return {
      ...base,
      status: 'info',
      detail: 'Vercel Analytics is not connected, so our own visitor count has nothing to be checked against',
      advice: 'Set VERCEL_API_TOKEN + VERCEL_PROJECT_ID in Railway (see backend/.env.example). Until then the funnel has a single, unverifiable source.',
    };
  }
  if (traffic.readable === false) {
    return {
      ...base,
      status: 'info',
      detail: 'Vercel Analytics cannot be read with this token, so our visitor count has nothing to be checked against',
      advice: traffic.fix,
    };
  }
  if (traffic.error) {
    return { ...base, status: 'info', detail: `Could not read Vercel Analytics: ${traffic.error}` };
  }

  // Our own number comes from the FUNNEL, which already owns "how many sessions"
  // — it is the number the founder sees, the advisor reasons about and the agents
  // quote. Counting sessions a second time here was the duplicated truth this
  // codebase keeps paying for: the check would have compared Vercel against a
  // figure nobody else uses, and could have declared the trackers in agreement
  // while the funnel on screen said something different.
  //
  // It also avoids a Visit.distinct('sessionId') over the window, which returns
  // every id in one array and is capped by the 16MB BSON limit — fine today,
  // broken silently at scale, and the exact reason funnel.js counts with a
  // $group/$count aggregation instead.
  const funnel = await require('../services/funnel').getFunnel(DAYS).catch(() => null);
  if (!funnel) {
    return { ...base, status: 'info', detail: 'Could not read our own visitor count to compare against' };
  }
  const ours = funnel.stages?.[0]?.count ?? 0;

  // What the gap MEANS is the service's call, and pinned by tests — the
  // thresholds are a judgement, not a detail.
  return { ...base, ...agreementVerdict({ ours, theirs: traffic.visitors, days: DAYS }) };
}

async function runChecks({ force = false } = {}) {
  // The feed check runs FIRST so its item count can be handed to the Merchant
  // Center check. Those two are the pair that has to be compared: one is what
  // we publish, the other is what Google holds, and until now nothing noticed
  // when they disagreed. Everything else still runs in parallel.
  const feedCheck = await checkMerchantFeed().catch(err => ({
    name: 'merchant_feed', label: 'Merchant feed', status: 'warning', detail: err.message,
  }));

  const results = await Promise.allSettled([
    checkApexRedirect(),
    checkSitemap(),
    Promise.resolve(feedCheck),
    checkHomepageCanonical(),
    checkCatalogue(),
    checkMerchantLive(feedCheck.itemCount ?? null),
    checkSerp(),
    checkAnalyticsAgreement({ force }),
  ]);

  const checks = results.flatMap(r =>
    r.status === 'fulfilled'
      ? (Array.isArray(r.value) ? r.value : [r.value])
      : [{ name: 'unknown', label: 'Unknown', status: 'warning', detail: r.reason?.message || 'Error' }]
  );

  const SEV = { healthy: 0, info: 1, warning: 2, critical: 3 };
  const overall = checks.reduce((worst, c) => (SEV[c.status] > SEV[worst] ? c.status : worst), 'healthy');

  return { overall, checks, checkedAt: new Date().toISOString() };
}

router.get('/', requireAuth, async (req, res) => {
  const now = Date.now();
  const force = req.query.force === 'true';
  if (!force && cache && now - cacheAt < CACHE_TTL) {
    return res.json({ ...cache, cached: true });
  }
  try {
    const result = await runChecks({ force });
    cache = result;
    cacheAt = now;
    res.json({ ...result, cached: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /resubmit-indexnow — manually re-submit the entire public surface to
// IndexNow (Bing/Yandex). Handy after a bulk import, a domain change, or to
// nudge a re-crawl. Gathers every live URL, de-dupes, and pings in chunks.
router.post('/resubmit-indexnow', requireAuth, async (req, res) => {
  try {
    const Collection = require('../models/Collection');
    const Category = require('../models/Category');
    const JournalArticle = require('../models/JournalArticle');
    const Bundle = require('../models/Bundle');
    const { EDITABLE_PATHS } = require('../services/pageSeo');
    const { pingIndexNow } = require('../services/indexNow');

    const STATIC_PATHS = ['/', '/shop', '/about', '/contact', '/faq', '/reviews',
      '/shipping', '/returns', '/size-guide', '/terms', '/privacy-policy',
      '/gift-wrapping', '/journal', '/style-finder'];

    const [products, collections, categories, articles, bundles] = await Promise.all([
      Product.find({ status: { $in: ['active', 'sold_out'] } }).select('_id slug').lean(),
      Collection.find({ status: 'active' }).select('slug').lean(),
      Category.find({ status: 'active' }).select('slug').lean(),
      JournalArticle.find({ status: 'published' }).select('slug').lean(),
      Bundle.find({ status: 'active' }).select('slug').lean(),
    ]);

    const urls = [...new Set([
      ...STATIC_PATHS,
      ...(EDITABLE_PATHS || []),
      ...products.map(p => `/product/${p.slug || p._id}`),
      ...collections.filter(c => c.slug).map(c => `/collections/${c.slug}`),
      ...categories.filter(c => c.slug).map(c => `/shop?category=${c.slug}`),
      ...articles.filter(a => a.slug).map(a => `/journal/${a.slug}`),
      ...bundles.filter(b => b.slug).map(b => `/bundles/${b.slug}`),
    ])];

    // pingIndexNow caps a single submission; chunk so a large catalogue all goes.
    for (let i = 0; i < urls.length; i += 100) pingIndexNow(urls.slice(i, i + 100), { source: 'manual', record: false });
    await require('../services/indexNow').recordLastSubmit(urls.length, 'manual');

    res.json({ submitted: urls.length });
  } catch (err) {
    console.error('[indexnow resubmit]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /indexnow-status — when the public surface was last submitted to IndexNow.
router.get('/indexnow-status', requireAuth, async (req, res) => {
  try {
    res.json(await require('../services/indexNow').getLastSubmit());
  } catch {
    res.json(null);
  }
});

module.exports = router;
