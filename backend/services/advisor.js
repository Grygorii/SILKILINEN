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
const Category = require('../models/Category');
const { misfiledCategory } = require('../utils/categoryFit');
const { isConfigured: merchantConfigured } = require('./merchantCenter');

const DAY = 24 * 60 * 60 * 1000;
const rec = (priority, category, title, why, action) => ({ priority, category, title, why, action });

/**
 * What to say when OUR tracker recorded nobody in the window.
 *
 * "No visitors" and "no visitor TRACKING" demand opposite actions and look
 * identical from our side alone, so Vercel's independent count decides which one
 * this is. Telling the founder to go and find traffic they already have is the
 * worse of the two errors: it sends them spending on distribution to fix a
 * JavaScript fault.
 *
 * @param {object} traffic a reading from services/vercelAnalytics.getTraffic
 */
function trafficRec(traffic) {
  if (traffic?.enabled && traffic.visitors > 0) {
    return rec('high', 'Fixes', `Vercel counted ${traffic.visitors} visitors and our own tracker counted none`,
      'People are arriving; we are failing to record them. The funnel, this list and every agent read OUR count, so they are all describing an empty shop — and any conversion work would be aimed at numbers that are not real.',
      'Open Health → "Visitor counts agree" for the check, then verify /api/track/visit is reachable from the storefront and that lib/track.ts is not throwing.');
  }
  // With Vercel also at zero this is corroborated; with Vercel unread it is a
  // single unverifiable source, and the advice says which.
  const corroborated = traffic?.enabled
    ? ' Vercel Analytics counted none either, so this is real and not a tracking fault.'
    : ' Only our own tracker says so — enable Vercel Analytics for a second opinion before trusting it.';
  return rec('high', 'Demand', 'No visitors in the last 14 days',
    `Nothing below this matters until someone arrives: meta descriptions, reviews and photography cannot convert an empty room.${corroborated}`,
    'Pick ONE channel and give it a fortnight — Instagram to an existing audience, or the Journal plus Search Console for search. Both are already wired up; the shop is waiting on distribution, not features.');
}

async function buildRecommendations() {
  const recs = [];

  const products = await Product.find({ status: { $in: ['active', 'sold_out'] } })
    .select('_id name category metaTitle metaDescription description images image colorName colours')
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

  // ── Category assignments ──
  // The category a product sits in is repeated in the breadcrumb, the shop
  // filter and the Shopping feed's product_type, so a wrong one is wrong in
  // three customer-facing places at once and none of them looks broken. The rule
  // lives in utils/categoryFit.js; both checks below read the LIVE category list
  // rather than a hardcoded one, because these slugs have been merged before.
  const categories = await Category.find().select('slug label status').lean().catch(() => []);
  const liveSlugs = categories.map(c => c.slug);
  const labelOf = slug => categories.find(c => c.slug === slug)?.label || slug;

  const misfiled = products
    .map(p => {
      const verdict = misfiledCategory(p.name, p.category, liveSlugs);
      return verdict ? { name: p.name, from: p.category, to: verdict.expected[0] } : null;
    })
    .filter(Boolean);
  if (misfiled.length) {
    const examples = misfiled.slice(0, 3)
      .map(m => `"${m.name}" is in ${labelOf(m.from)}, not ${labelOf(m.to)}`)
      .join('; ');
    recs.push(rec('medium', 'Fixes', `${misfiled.length} product${misfiled.length > 1 ? 's are' : ' is'} filed under the wrong category`,
      `The category shows in the breadcrumb, the shop filter and the Shopping feed's product_type, so each one is wrong in three places at once. ${examples}.`,
      'Open each in Products → set Category. The breadcrumb and feed follow on the next crawl.'));
  }

  // Archived categories holding nothing. Not a customer-facing leak — hence low
  // — but they clutter every category picker and their displayOrder values
  // collide with the live ones. Count EVERY product, not just the active ones
  // above: a category holding three drafts is not empty.
  const perCategory = await Product.aggregate([
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]).catch(() => []);
  const countOf = Object.fromEntries(perCategory.map(c => [c._id, c.count]));
  const archivedEmpty = categories.filter(c => c.status === 'archived' && !countOf[c.slug]);
  if (archivedEmpty.length) {
    recs.push(rec('low', 'Fixes', `${archivedEmpty.length} archived categor${archivedEmpty.length > 1 ? 'ies hold' : 'y holds'} no products`,
      `An archived category still clutters the category picker, and its display order collides with the live ones: ${archivedEmpty.map(c => c.label).join(', ')}.`,
      'Delete in Categories. The slugs that were merged away still 301 to their new parent from the shop route, so no search ranking is lost.'));
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

  // ── Is anybody actually arriving? ──
  // The advisor had no answer to the first question a shop with no sales should
  // ask. With no traffic, every other item on this list is polish: better meta
  // descriptions and more reviews cannot sell to nobody, but they LOOK like
  // progress, and the list would happily lead with them for months.
  //
  // Two counts are consulted, because "no visitors" and "no visitor TRACKING"
  // demand opposite actions and look identical from our side alone — telling the
  // founder to go find traffic they already have is the worse of the two errors.
  if (!funnel?.hasData) {
    const traffic = await require('./vercelAnalytics').getTrafficCached({ days: 14 })
      .catch(() => ({ configured: false }));
    recs.push(trafficRec(traffic));
  }

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
      `Searches that return an empty page are the clearest demand signal we get. Re-checked against the catalogue just now, so this is a real gap and not the search failing.${rest ? ` Also unmet: ${rest}.` : ''}`,
      'Either stock it, or add the word to a product that is effectively it — a synonym in the title fixes a naming mismatch without new stock.'));
  }

  // Searches that failed when they were made and work today. Different problem,
  // different action: nothing to stock, but sales were lost to the search box
  // while the product sat on the shelf.
  if (cs?.nowFindable?.length) {
    const top = cs.nowFindable[0];
    const people = cs.nowFindable.reduce((n, u) => n + u.people, 0);
    recs.push(rec('medium', 'Conversion', `${people} searched for something we DO sell and were shown an empty page`,
      `"${top.term}" now returns ${top.nowFinds} product${top.nowFinds === 1 ? '' : 's'} but returned none when they searched. The product was on the shelf; the search box lost the sale.`,
      'Nothing to stock. Worth checking the wording those searches used appears in the product title or colour name, so the next person finds it first time.'));
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

module.exports = { buildRecommendations, trafficRec };
