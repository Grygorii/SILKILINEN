'use strict';

// Shared advisor logic — the prioritised "what to do next to grow" list,
// derived from live data. Used by both the dashboard route (/api/admin/advisor)
// and the weekly email digest cron, so there is a single source of truth.
//
// Priorities:
//   high        — costing you money / blocking growth now
//   medium      — clear SEO/conversion win
//   low         — nice-to-have / housekeeping
//   opportunity — you're ready to do something new (e.g. ads)

const Product = require('../models/Product');
const Review = require('../models/Review');
const JournalArticle = require('../models/JournalArticle');
const SiteAudit = require('../models/SiteAudit');
const { isConfigured: merchantConfigured } = require('./merchantCenter');

const DAY = 24 * 60 * 60 * 1000;
const rec = (priority, category, title, why, action) => ({ priority, category, title, why, action });

async function buildRecommendations() {
  const recs = [];

  const products = await Product.find({ status: { $in: ['active', 'sold_out'] } })
    .select('_id metaTitle metaDescription description images image')
    .lean();
  const activeCount = products.length;

  // ── Catalogue completeness (Merchant + conversion) ──
  const hasImage = p => (Array.isArray(p.images) && p.images.some(i => i && i.url)) || Boolean(p.image);
  const noImage = products.filter(p => !hasImage(p)).length;
  const thinDesc = products.filter(p => !p.description || p.description.trim().length < 20).length;
  const noMeta = products.filter(p => !p.metaTitle || !p.metaDescription).length;

  if (noImage > 0) {
    recs.push(rec('high', 'Fixes', `${noImage} product${noImage > 1 ? 's' : ''} missing an image`,
      'Products without an image get disapproved by Merchant Center and convert poorly.',
      'Open each in Products → add a primary image.'));
  }
  if (thinDesc > 0) {
    recs.push(rec('medium', 'SEO', `${thinDesc} product${thinDesc > 1 ? 's' : ''} with a thin/missing description`,
      'Google needs real copy to rank a page and Merchant needs it to approve the item.',
      'Add at least a few sentences of unique description per product.'));
  }
  if (noMeta > 0) {
    recs.push(rec('medium', 'SEO', `${noMeta} of ${activeCount} products missing meta title/description`,
      'Meta tags are what shows in Google results — better copy lifts click-through.',
      'Fill metaTitle (≤70 chars) and metaDescription (≤165) in the product editor.'));
  }

  // ── Reviews (conversion + rich snippets) ──
  const reviewedIds = await Review.distinct('productId', { status: 'approved', productId: { $ne: null } });
  const reviewedSet = new Set(reviewedIds.map(String));
  const noReviews = products.filter(p => !reviewedSet.has(String(p._id))).length;
  if (activeCount > 0 && noReviews > 0) {
    recs.push(rec('medium', 'Reviews', `${noReviews} product${noReviews > 1 ? 's' : ''} with no reviews`,
      'Reviews lift conversion and unlock star ratings in search results.',
      'Email recent buyers a review request, or import existing Etsy reviews.'));
  }

  // ── Journal / content cadence (SEO) ──
  const publishedCount = await JournalArticle.countDocuments({ status: 'published' });
  const latest = await JournalArticle.findOne({ status: 'published' }).sort({ publishedAt: -1 }).select('publishedAt').lean();
  const daysSince = latest?.publishedAt ? Math.floor((Date.now() - new Date(latest.publishedAt).getTime()) / DAY) : null;
  if (publishedCount < 4) {
    recs.push(rec('medium', 'Content', `Only ${publishedCount} journal article${publishedCount === 1 ? '' : 's'} published`,
      'Keyword-rich articles are how a new store earns long-tail search traffic.',
      'Aim for one article/week on silk care, gifting, sleep — target real search terms.'));
  } else if (daysSince !== null && daysSince > 30) {
    recs.push(rec('low', 'Content', `No new journal article in ${daysSince} days`,
      'Fresh content signals an active site and keeps Google crawling.',
      'Publish a new journal piece to keep the cadence up.'));
  }

  // ── Merchant Center / ads readiness ──
  if (!merchantConfigured()) {
    recs.push(rec('high', 'Merchant', 'Connect Merchant Center for live data',
      'Without it the dashboard can only guess at why products are rejected.',
      'Finish the setup in docs/google-api-setup.md and set the Railway env vars.'));
  } else {
    recs.push(rec('opportunity', 'Ads', 'Merchant Center is connected — you can run free + paid Google listings',
      'Once products are approved you appear in the free Shopping tab and can run Performance Max.',
      'Clear any disapprovals (see the health panel), then test a small Performance Max budget.'));
  }

  // ── Open issues from the last site audit ──
  const audit = await SiteAudit.findOne({ status: 'completed' }).sort({ runAt: -1 }).select('findings runAt').lean();
  if (audit) {
    const open = (audit.findings || []).filter(f => f.status === 'open');
    const critical = open.filter(f => f.severity === 'critical').length;
    const warning = open.filter(f => f.severity === 'warning').length;
    if (critical > 0) {
      recs.push(rec('high', 'Fixes', `${critical} unresolved critical issue${critical > 1 ? 's' : ''} from the last site audit`,
        'Critical audit findings are usually broken links or journeys that lose customers.',
        'Open Site Audit and work through the critical findings.'));
    } else if (warning > 0) {
      recs.push(rec('low', 'Fixes', `${warning} open warning${warning > 1 ? 's' : ''} from the last site audit`,
        'Smaller issues that chip away at experience and SEO.',
        'Review them in Site Audit when you have time.'));
    }
  } else {
    recs.push(rec('low', 'Fixes', 'No site audit has been run recently',
      'A periodic audit catches broken links and inconsistent journeys before customers do.',
      'Run a Site Audit from the admin.'));
  }

  const ORDER = { high: 0, medium: 1, opportunity: 2, low: 3 };
  recs.sort((a, b) => ORDER[a.priority] - ORDER[b.priority]);
  return recs;
}

module.exports = { buildRecommendations };
