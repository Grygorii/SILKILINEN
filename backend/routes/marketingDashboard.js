const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { aiLimit } = require('../middleware/rateLimiters');
const Campaign = require('../models/Campaign');
const Order = require('../models/Order');
const Visit = require('../models/Visit');
const MarketingAnalysis = require('../models/MarketingAnalysis');
const Newsletter = require('../models/Newsletter');
const { generateAnalysis } = require('../services/marketingAnalysis');

const PAID_STATUSES = ['paid', 'processing', 'shipped', 'delivered'];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function thirtyDaysAgo() {
  return new Date(Date.now() - 30 * 24 * 3600 * 1000);
}

// ── GET /api/admin/marketing/dashboard ──────────────────────────────────────

router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const todayStart = startOfToday();
    const ago30d     = thirtyDaysAgo();

    const [
      todayOrders,
      campaigns,
      analysis,
      topCampaignVisits,
      adOrders30d,
    ] = await Promise.all([
      Order.find({ status: { $in: PAID_STATUSES }, createdAt: { $gte: todayStart } }).lean(),
      Campaign.find({}).sort({ createdAt: -1 }).lean(),
      MarketingAnalysis.findOne({ dateStr: todayStr() }).lean(),
      // Top channel geo breakdown
      Visit.aggregate([
        { $match: { createdAt: { $gte: ago30d }, 'utm.campaign': { $exists: true, $ne: null } } },
        { $group: { _id: { country: '$country', source: '$source' }, visitors: { $addToSet: '$sessionId' } } },
        { $project: { country: '$_id.country', source: '$_id.source', visitors: { $size: '$visitors' } } },
        { $sort: { visitors: -1 } },
        { $limit: 10 },
      ]),
      Order.find({ status: { $in: PAID_STATUSES }, createdAt: { $gte: ago30d }, 'utm.campaign': { $exists: true, $ne: null } }).lean(),
    ]);

    const todayRevenue = todayOrders.reduce((s, o) => s + (o.total || 0), 0);
    const todayOrderCount = todayOrders.length;

    // Today's ad spend: sum of spend updates dated today across all campaigns
    const todaySpend = campaigns.reduce((sum, c) => {
      const updates = (c.spendUpdates || []).filter(u => {
        const d = new Date(u.date);
        return d >= todayStart;
      });
      return sum + updates.reduce((s, u) => s + u.amount, 0);
    }, 0);

    const activeCampaigns = campaigns.filter(c => c.status === 'active');
    const todayAdOrders   = todayOrders.filter(o => o.utm?.campaign).length;
    const todayRoas       = todaySpend > 0 ? todayRevenue / todaySpend : null;

    // Summary sentence
    const summaryLine = activeCampaigns.length === 0
      ? 'No active campaigns running right now.'
      : `You're running ${activeCampaigns.length} active campaign${activeCampaigns.length !== 1 ? 's' : ''}. €${todaySpend.toFixed(2)} spent today, ${todayAdOrders} order${todayAdOrders !== 1 ? 's' : ''} attributed.`;

    // Campaign list with quick stats.
    // Spend is windowed to last 30d (sum of spendUpdates dated within that
    // window) so it lines up apples-to-apples with revenue and ROAS.
    // The previous behaviour used lifetime c.spend / 30d revenue which
    // gave a systematically wrong ROAS — see SILKILINEN.md INFO-1 entry.
    const campaignRows = campaigns.map(c => {
      const campOrders = adOrders30d.filter(o =>
        o.utm?.campaign === c.slug || o.attribution?.campaign === c.slug
      );
      const revenue = campOrders.reduce((s, o) => s + (o.total || 0) - (o.refundedAmount || 0), 0);
      const spend30d = (c.spendUpdates || [])
        .filter(u => new Date(u.date) >= ago30d)
        .reduce((s, u) => s + (u.amount || 0), 0);
      const roas    = spend30d > 0 ? revenue / spend30d : null;
      const lastCreative = c.creatives?.length > 0 ? c.creatives[c.creatives.length - 1].name : null;
      return {
        _id:         c._id,
        name:        c.name,
        slug:        c.slug,
        channel:     c.channel,
        status:      c.status,
        spend:       spend30d,
        spendLifetime: c.spend || 0,
        budget:      c.budget || 0,
        orders:      campOrders.length,
        revenue,
        roas,
        lastCreative,
        createdAt:   c.createdAt,
      };
    });

    // Top products by ad attribution (30d)
    const productMap = {};
    for (const o of adOrders30d) {
      for (const item of (o.items || [])) {
        const key = String(item.productId || item.name);
        if (!productMap[key]) productMap[key] = { name: item.name, units: 0, revenue: 0 };
        productMap[key].units   += item.quantity || 1;
        productMap[key].revenue += (item.price || 0) * (item.quantity || 1);
      }
    }
    const topAdProducts = Object.values(productMap).sort((a, b) => b.units - a.units).slice(0, 5);

    // Top creatives (30d)
    const creativeMap = {};
    for (const o of adOrders30d) {
      const key = o.utm?.content || 'unknown';
      if (!creativeMap[key]) creativeMap[key] = { utmContent: key, orders: 0, revenue: 0 };
      creativeMap[key].orders++;
      creativeMap[key].revenue += (o.total || 0) - (o.refundedAmount || 0);
    }
    const topCreatives = Object.values(creativeMap).sort((a, b) => b.orders - a.orders).slice(0, 5);

    // Revenue by channel (30d)
    const channelMap = {};
    for (const o of adOrders30d) {
      const ch = o.utm?.source || o.attribution?.source || 'other';
      channelMap[ch] = (channelMap[ch] || 0) + (o.total || 0) - (o.refundedAmount || 0);
    }
    const revenueByChannel = Object.entries(channelMap)
      .map(([channel, revenue]) => ({ channel, revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    // Geo breakdown for paid campaign visitors
    const geoCountries = topCampaignVisits
      .filter(c => c.country)
      .reduce((acc, c) => {
        const idx = acc.findIndex(a => a.country === c.country);
        if (idx >= 0) acc[idx].visitors += c.visitors;
        else acc.push({ country: c.country, visitors: c.visitors });
        return acc;
      }, [])
      .sort((a, b) => b.visitors - a.visitors)
      .slice(0, 5);

    res.json({
      pulse: {
        todayRevenue,
        todayOrders:    todayOrderCount,
        todayAdOrders,
        todaySpend,
        todayRoas,
        summaryLine,
        activeCampaignCount: activeCampaigns.length,
      },
      analysis: analysis ? {
        bullets:     analysis.bullets,
        generatedAt: analysis.generatedAt,
      } : null,
      campaigns: campaignRows,
      topAdProducts,
      topCreatives,
      revenueByChannel,
      geoCountries,
    });
  } catch (err) {
    console.error('[marketing dashboard]', err.message);
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/admin/marketing/analysis/regenerate ────────────────────────────

router.post('/analysis/regenerate', requireAuth, aiLimit, async (req, res) => {
  try {
    const doc = await generateAnalysis();
    res.json({ bullets: doc.bullets, founderBullets: doc.founderBullets, generatedAt: doc.generatedAt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/admin/marketing/founder ─────────────────────────────────────────

router.get('/founder', requireAuth, async (req, res) => {
  try {
    const ago7d  = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday

    const [campaigns, weekOrders, analysis] = await Promise.all([
      Campaign.find({ status: { $in: ['active', 'paused', 'ended'] } }).lean(),
      Order.find({ status: { $in: PAID_STATUSES }, createdAt: { $gte: weekStart } }).lean(),
      MarketingAnalysis.findOne({ dateStr: new Date().toISOString().slice(0, 10) }).lean(),
    ]);

    const weekAdOrders  = weekOrders.filter(o => o.utm?.campaign);
    const weekRevenue   = weekAdOrders.reduce((s, o) => s + (o.total || 0), 0);
    const totalSpend    = campaigns.reduce((s, c) => s + (c.spend || 0), 0);
    const weekSpend     = campaigns.reduce((sum, c) => {
      const updates = (c.spendUpdates || []).filter(u => new Date(u.date) >= weekStart);
      return sum + updates.reduce((s, u) => s + u.amount, 0);
    }, 0);
    const weekRoas      = weekSpend > 0 ? weekRevenue / weekSpend : null;

    // Top product this week on ads
    const productMap = {};
    for (const o of weekAdOrders) {
      for (const item of (o.items || [])) {
        const key = item.name || 'Unknown';
        const ch  = o.utm?.source || o.attribution?.source || 'ad';
        if (!productMap[key]) productMap[key] = { name: key, units: 0, channel: ch };
        productMap[key].units += item.quantity || 1;
      }
    }
    const topProduct = Object.values(productMap).sort((a, b) => b.units - a.units)[0] || null;

    // Top creative this week
    const creativeMap = {};
    for (const o of weekAdOrders) {
      const key = o.utm?.content;
      if (!key) continue;
      if (!creativeMap[key]) creativeMap[key] = { utmContent: key, orders: 0 };
      creativeMap[key].orders++;
    }
    const topCreative = Object.values(creativeMap).sort((a, b) => b.orders - a.orders)[0] || null;

    res.json({
      weekRevenue,
      weekSpend,
      weekRoas,
      weekAdOrderCount: weekAdOrders.length,
      topProduct,
      topCreative,
      founderBullets: analysis?.founderBullets || [],
      generatedAt:    analysis?.generatedAt || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/marketing/subscribers — make the captured email list usable:
// the count, a source breakdown (style-finder / popup / …), and the recent ones.
// Without this the Style Finder & popup leads sit in the DB unseen.
router.get('/subscribers', requireAuth, async (req, res) => {
  try {
    const [total, unsubscribed, bySource, recent] = await Promise.all([
      Newsletter.countDocuments({ isUnsubscribed: { $ne: true } }),
      Newsletter.countDocuments({ isUnsubscribed: true }),
      Newsletter.aggregate([
        { $match: { isUnsubscribed: { $ne: true } } },
        { $group: { _id: '$source', n: { $sum: 1 } } },
        { $sort: { n: -1 } },
      ]),
      Newsletter.find({ isUnsubscribed: { $ne: true } })
        .sort({ subscribedAt: -1 }).limit(20)
        .select('email source subscribedAt discountCodeUsed').lean(),
    ]);
    res.json({
      total,
      unsubscribed,
      bySource: bySource.map(s => ({ source: s._id || 'unknown', count: s.n })),
      recent,
    });
  } catch (err) {
    console.error('[marketing] subscribers error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/marketing/subscribers/export.csv — download the active list to
// import into the founder's email tool (the Newsletter Drafter writes the copy).
router.get('/subscribers/export.csv', requireAuth, async (req, res) => {
  try {
    const subs = await Newsletter.find({ isUnsubscribed: { $ne: true } })
      .sort({ subscribedAt: -1 }).select('email source subscribedAt').lean();
    const rows = ['email,source,subscribedAt'];
    for (const s of subs) {
      rows.push([s.email, s.source, s.subscribedAt ? new Date(s.subscribedAt).toISOString() : '']
        .map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="subscribers.csv"');
    res.send(rows.join('\n'));
  } catch (err) {
    console.error('[marketing] subscribers export error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
