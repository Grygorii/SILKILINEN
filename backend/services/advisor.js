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
    .select('_id name metaTitle metaDescription description images image colorName colours')
    .lean();
  const activeCount = products.length;

  // ── Catalogue completeness (Merchant + conversion) ──
  const hasImage = p => (Array.isArray(p.images) && p.images.some(i => i && i.url)) || Boolean(p.image);
  const noImage = products.filter(p => !hasImage(p)).length;
  const thinDesc = products.filter(p => !p.description || p.description.trim().length < 20).length;
  const noMeta = products.filter(p => !p.metaTitle || !p.metaDescription).length;

  // ── Google Shopping feed completeness ──
  // Google requires `color` on apparel. The feed derives one from colorName,
  // colours[], or a colour word in the title (see frontend feed route) — so a
  // product only fails when all three are empty. Those items stay approved for
  // FREE listings and are excluded from paid Shopping ads, which is a silent
  // ceiling: nothing is broken, the reach is just capped.
  const noColour = products.filter(p =>
    !p.colorName && !(Array.isArray(p.colours) && p.colours.length));
  if (noColour.length) {
    const names = noColour.slice(0, 4).map(p => p.name).filter(Boolean).join(', ');
    recs.push(rec('medium', 'Fixes', `${noColour.length} product${noColour.length > 1 ? 's have' : ' has'} no colour set`,
      `Google requires a colour on apparel. These stay eligible for free listings but are held out of Shopping ads.${names ? ` Starts with: ${names}.` : ''}`,
      'Open each in Products → set Colour (or add a variant colour). The feed picks it up on the next crawl.'));
  }

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
  // ── Conversion funnel ──
  // The advisor feeds both the dashboard and the weekly email digest, so this is
  // where a funnel finding actually reaches the founder unprompted rather than
  // waiting for someone to open a panel. Everything here is already sample-gated
  // in services/funnel.js; if the gates withheld it, nothing is added — an
  // advisor that invents urgency from four sessions trains you to ignore it.
  const funnel = await require('./funnel').getFunnel(14).catch(() => null);
  if (funnel?.hasData) {
    const shift = funnel.biggestShift;
    if (shift && shift.direction === 'down') {
      recs.push(rec('high', 'Conversion', `"${shift.label}" fell ${Math.abs(shift.delta)} points`,
        `It converted ${shift.ratePrev}% in the previous 14 days and ${shift.rateNow}% now — this is a change, not a level, so something moved.`,
        shift.fix ? `Open ${shift.fix.label}.` : 'Check what changed on that step.'));
    }

    const d = funnel.diagnosis;
    if (d?.device) {
      recs.push(rec('high', 'Conversion', `${d.device.segment} converts ${d.device.bestRate - d.device.rate} points worse`,
        `At the worst-leaking step, ${d.device.segment} keeps ${d.device.rate}% against ${d.device.bestRate}% on ${d.device.bestSegment} — ${d.device.lost} people lost.`,
        `Walk that step on ${d.device.segment} yourself, then check Session Replay.`));
    }
    if (d?.products?.length) {
      const worst = d.products[0];
      recs.push(rec('medium', 'Conversion', `"${worst.name}" loses most of its viewers`,
        `${worst.added} of ${worst.viewed} people who opened it added it to the cart (${worst.rate}%).`,
        'Open it in Products — photography, price framing, or sizing confidence.'));
    }
  }

  // ── Demand we did not meet ──
  // A zero-result search is a customer who told us exactly what they wanted and
  // left with nothing. It reaches the weekly digest because it decays: knowing
  // three people searched "silk kimono" last week is actionable, knowing it
  // three months later is trivia.
  const cs = await require('./clickstream').getClickstreamSignals(14).catch(() => null);
  if (cs?.unmetSearches?.length) {
    const top = cs.unmetSearches[0];
    const rest = cs.unmetSearches.slice(1, 4).map(u => `"${u.term}"`).join(', ');
    recs.push(rec('high', 'Demand', `${top.people} searched "${top.term}" and found nothing`,
      `Searches that return an empty page are the clearest demand signal we get.${rest ? ` Also unmet: ${rest}.` : ''}`,
      'Check whether we already sell it under a different name — a synonym in the product title fixes it without new stock.'));
  }

  // ── People waiting on a restock ──
  // Named demand with an email attached: the strongest signal in the shop,
  // because the sale is already agreed and only the stock is missing.
  const waiting = await require('../models/StockNotification').aggregate([
    { $match: { notifiedAt: null } },
    { $group: { _id: '$product', people: { $sum: 1 } } },
    { $sort: { people: -1 } },
    { $limit: 3 },
  ]).catch(() => []);
  if (waiting.length) {
    const names = await Product.find({ _id: { $in: waiting.map(w => w._id) } })
      .select('_id name').lean().catch(() => []);
    const byId = Object.fromEntries(names.map(p => [String(p._id), p.name]));
    const top = waiting[0];
    const label = byId[String(top._id)];
    if (label) {
      recs.push(rec('high', 'Demand', `${top.people} waiting for "${label}" to return`,
        'They left an email for this exact piece — the sale is agreed, only the stock is missing. They are emailed automatically the hour it goes back in stock.',
        'Restock it, or set the stock level if it has already arrived.'));
    }
  }

  // Rank, then decide. Sixteen recommendations sorted by priority is still a
  // list, and a list of sixteen is a list nobody works through — the failure
  // mode of every advisory panel. Within a priority band, put the items whose
  // cause is a NAMED person or piece first: "4 people are waiting for the Sky
  // Blue robe" is actionable in a way "12 products are missing meta
  // descriptions" is not, even though both are high priority.
  //
  // Demand and Conversion are named-cause categories: they came from someone's
  // actual behaviour this fortnight, and they decay — acting next month is
  // worth less. Housekeeping keeps.
  const URGENCY = { Demand: 0, Conversion: 1 };
  recs.sort((a, b) =>
    (ORDER[a.priority] - ORDER[b.priority]) ||
    ((URGENCY[a.category] ?? 9) - (URGENCY[b.category] ?? 9)));
  return recs;
}

module.exports = { buildRecommendations };
