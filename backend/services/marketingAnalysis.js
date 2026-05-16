const Campaign = require('../models/Campaign');
const MarketingAnalysis = require('../models/MarketingAnalysis');
const Order = require('../models/Order');
const Visit = require('../models/Visit');

const PAID_STATUSES = ['paid', 'processing', 'shipped', 'delivered'];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function sevenDaysAgo() {
  return new Date(Date.now() - 7 * 24 * 3600 * 1000);
}

// ── Internal founder-to-Sabreen translation ──────────────────────────────────
// Maps each rule key to a plain-English recommendation for the founder view.
const FOUNDER_TRANSLATIONS = {
  outperforming: (b) => b.replace(/is outperforming/, 'is earning well —').replace(/Recommend/, 'Keep going'),
  no_orders:     (b) => b.replace('has spent', 'has been running and spent').replace('Recommend pausing or revising.', 'Consider pausing it and trying different images or copy.'),
  creative_no_conv: (b) => b.replace('Copy mismatch likely.', 'Try a different headline or image.'),
  no_spend:      (b) => b.replace('Was this intentional?', 'If you meant to pause, that\'s fine — just checking.'),
  spike:         (b) => b.replace('investigate top landing pages.', 'check which posts or pins are driving it.'),
  top_product:   (b) => b.replace('consider doubling down', 'make more creatives featuring it'),
  default:       (b) => b,
};

function toFounderBullet(bullet, ruleKey) {
  const fn = FOUNDER_TRANSLATIONS[ruleKey] || FOUNDER_TRANSLATIONS.default;
  return fn(bullet);
}

// ── Rule engine ──────────────────────────────────────────────────────────────

async function generateAnalysis() {
  const since7d = sevenDaysAgo();
  const since3d = new Date(Date.now() - 3 * 24 * 3600 * 1000);

  const [campaigns, orders7d, visits7d] = await Promise.all([
    Campaign.find({ status: { $in: ['active', 'ended', 'paused'] } }).lean(),
    Order.find({ status: { $in: PAID_STATUSES }, createdAt: { $gte: since7d } }).lean(),
    Visit.find({ createdAt: { $gte: since7d } }).lean(),
  ]);

  const activeCampaigns = campaigns.filter(c => c.status === 'active');

  // Per-campaign stats (matched on utm.campaign slug)
  const campaignStats = campaigns.map(camp => {
    const campOrders = orders7d.filter(o => o.utm?.campaign === camp.slug || o.attribution?.campaign === camp.slug);
    const revenue    = campOrders.reduce((s, o) => s + (o.total || 0) - (o.refundedAmount || 0), 0);
    const spend      = camp.spend || 0;
    const roas       = spend > 0 ? revenue / spend : null;

    // Per-creative breakdown
    const creativeMap = {};
    for (const o of campOrders) {
      const key = o.utm?.content || 'unknown';
      creativeMap[key] = (creativeMap[key] || 0) + 1;
    }

    // Visit counts for this campaign's slug
    const campVisits = visits7d.filter(v => v.utm?.campaign === camp.slug);
    const uniqueSessions = new Set(campVisits.map(v => v.sessionId)).size;

    return {
      campaign:  camp,
      orders:    campOrders.length,
      revenue,
      spend,
      roas,
      visits:    uniqueSessions,
      creativeMap,
    };
  });

  // Channel visit counts for spike detection
  const channelCounts7d = {};
  const channelCounts14to7 = [];
  const since14d = new Date(Date.now() - 14 * 24 * 3600 * 1000);
  const visits14d = await Visit.find({ createdAt: { $gte: since14d, $lt: since7d } }).lean();

  for (const v of visits7d)  { channelCounts7d[v.source] = (channelCounts7d[v.source] || 0) + 1; }
  const priorCounts = {};
  for (const v of visits14d) { priorCounts[v.source] = (priorCounts[v.source] || 0) + 1; }

  const bullets     = [];
  const founderB    = [];
  const ruleKeys    = [];

  function addBullet(bullet, ruleKey) {
    bullets.push(bullet);
    founderB.push(toFounderBullet(bullet, ruleKey));
    ruleKeys.push(ruleKey);
  }

  // Rule 1: outperforming campaigns (ROAS ≥ 2x, spend ≥ €20)
  for (const s of campaignStats) {
    if (s.roas !== null && s.roas >= 2 && s.spend >= 20) {
      addBullet(
        `${s.campaign.name} is outperforming — €${s.revenue.toFixed(2)} revenue from €${s.spend.toFixed(2)} spend (${s.roas.toFixed(1)}× ROAS).`,
        'outperforming'
      );
    }
  }

  // Rule 2: spend ≥ €20 but 0 orders
  for (const s of campaignStats) {
    if (s.spend >= 20 && s.orders === 0 && s.campaign.status === 'active') {
      addBullet(
        `${s.campaign.name} has spent €${s.spend.toFixed(2)} with no orders in the last 7 days. Recommend pausing or revising.`,
        'no_orders'
      );
    }
  }

  // Rule 3: creative ≥ 50 visits, 0 orders (visit-keyed by utmContent)
  for (const s of campaignStats) {
    for (const creative of s.campaign.creatives || []) {
      const creativeVisits = visits7d.filter(v =>
        v.utm?.campaign === s.campaign.slug && v.utm?.content === creative.utmContent
      ).length;
      const creativeOrders = s.creativeMap[creative.utmContent] || 0;
      if (creativeVisits >= 50 && creativeOrders === 0) {
        addBullet(
          `Creative "${creative.name}" is getting clicks but no conversions. Copy mismatch likely.`,
          'creative_no_conv'
        );
      }
    }
  }

  // Rule 4: active campaigns with no spend in last 3 days
  if (activeCampaigns.length > 0) {
    const recentSpendBySlug = {};
    for (const c of activeCampaigns) {
      const recentUpdates = (c.spendUpdates || []).filter(u => new Date(u.date) >= since3d);
      recentSpendBySlug[c.slug] = recentUpdates.reduce((s, u) => s + u.amount, 0);
    }
    const noRecentSpend = activeCampaigns.filter(c => (recentSpendBySlug[c.slug] || 0) === 0);
    if (noRecentSpend.length > 0 && noRecentSpend.length === activeCampaigns.length) {
      addBullet(
        `Active campaigns showing no spend in 3 days. Was this intentional?`,
        'no_spend'
      );
    }
  }

  // Rule 5: channel traffic spike >50% vs 7-day average
  for (const [source, count7d] of Object.entries(channelCounts7d)) {
    const prior = priorCounts[source] || 0;
    if (prior > 0 && count7d > prior * 1.5) {
      addBullet(
        `${source.charAt(0).toUpperCase() + source.slice(1)} traffic spiked this week — investigate top landing pages.`,
        'spike'
      );
    }
  }

  // Rule 6: single product >40% of ad-attributed orders
  if (orders7d.length > 0) {
    const productMap = {};
    const adOrders = orders7d.filter(o => o.utm?.campaign);
    if (adOrders.length >= 3) {
      for (const o of adOrders) {
        for (const item of (o.items || [])) {
          const key = item.name || 'Unknown';
          productMap[key] = (productMap[key] || 0) + (item.quantity || 1);
        }
      }
      const total = adOrders.length;
      for (const [name, count] of Object.entries(productMap)) {
        if (count / total > 0.4) {
          addBullet(
            `${name} accounts for ${Math.round((count / total) * 100)}% of ad-attributed orders — consider doubling down on this product.`,
            'top_product'
          );
        }
      }
    }
  }

  // Rule 7: default if nothing fired
  if (bullets.length === 0) {
    const hasActiveCampaigns = activeCampaigns.length > 0;
    addBullet(
      hasActiveCampaigns
        ? 'Campaigns are running steady. No significant changes detected this week.'
        : 'No active campaigns. Create a campaign to start tracking ad performance.',
      'default'
    );
  }

  // ── Persist ───────────────────────────────────────────────────────────────
  const dateKey = todayStr();
  const totalRevenue7d = orders7d.reduce((s, o) => s + (o.total || 0) - (o.refundedAmount || 0), 0);
  const totalSpend7d   = campaigns.reduce((s, c) => s + (c.spend || 0), 0);

  const doc = await MarketingAnalysis.findOneAndUpdate(
    { dateStr: dateKey },
    {
      dateStr:        dateKey,
      bullets,
      founderBullets: founderB,
      generatedAt:    new Date(),
      dataSnapshot: {
        activeCampaigns: activeCampaigns.length,
        totalSpend7d,
        totalOrders7d:   orders7d.length,
        totalRevenue7d,
      },
    },
    { upsert: true, new: true }
  );

  return doc;
}

module.exports = { generateAnalysis };
