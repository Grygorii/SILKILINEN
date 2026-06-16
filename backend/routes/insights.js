const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Visit = require('../models/Visit');
const Event = require('../models/Event');
const { requireAuth } = require('../middleware/auth');

let cache = { data: null, at: 0 };
const CACHE_TTL = 5 * 60 * 1000;

router.get('/', requireAuth, async function(req, res) {
  if (cache.data && Date.now() - cache.at < CACHE_TTL) {
    return res.json(cache.data);
  }

  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const abandonedCutoff = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    const [todayOrders, attributionRaw, abandonedCount, last30DaysPaid] = await Promise.all([
      Order.find({ status: 'paid', createdAt: { $gte: todayStart } }).lean(),
      Order.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: '$attribution.source', orders: { $sum: 1 }, revenue: { $sum: '$total' } } },
        { $sort: { revenue: -1 } },
      ]),
      Order.countDocuments({ status: 'pending', createdAt: { $lt: abandonedCutoff } }),
      Order.find({
        status: 'paid',
        createdAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
      }).lean(),
    ]);

    const todayRevenue = todayOrders.reduce((s, o) => s + (o.total ?? 0), 0);
    const todayOrderCount = todayOrders.length;

    const totalPaidRevenue = attributionRaw.reduce((s, r) => s + r.revenue, 0);
    const attribution = attributionRaw.map(r => ({
      source:  r._id || 'direct',
      orders:  r.orders,
      revenue: r.revenue,
      pct:     totalPaidRevenue > 0 ? Math.round((r.revenue / totalPaidRevenue) * 100) : 0,
    }));

    const productMap = {};
    for (const order of last30DaysPaid) {
      for (const item of order.items ?? []) {
        if (!item.name) continue;
        if (!productMap[item.name]) productMap[item.name] = { name: item.name, qty: 0, revenue: 0 };
        productMap[item.name].qty += item.quantity ?? 1;
        productMap[item.name].revenue += (item.price ?? 0) * (item.quantity ?? 1);
      }
    }
    const topProducts = Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const insights = generateInsights({ todayRevenue, todayOrderCount, abandonedCount, attribution, topProducts, last30: last30DaysPaid });

    const data = {
      today: { revenue: todayRevenue, orders: todayOrderCount, abandonedCarts: abandonedCount },
      attribution,
      topProducts,
      insights,
    };

    cache = { data, at: Date.now() };
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function generateInsights({ todayRevenue, todayOrderCount, abandonedCount, attribution, topProducts, last30 }) {
  const insights = [];

  if (abandonedCount > 0) {
    insights.push({
      type: 'warning',
      title: `${abandonedCount} abandoned cart${abandonedCount > 1 ? 's' : ''}`,
      body: 'Orders started but not completed in the last 2+ hours. Consider a recovery email sequence.',
    });
  }

  const topSource = attribution[0];
  if (topSource && topSource.pct >= 50) {
    insights.push({
      type: 'info',
      title: `${topSource.pct}% of revenue from ${topSource.source}`,
      body: 'High channel concentration — diversifying could reduce risk.',
    });
  }

  const directEntry = attribution.find(a => a.source === 'direct');
  if (directEntry && directEntry.pct >= 60) {
    insights.push({
      type: 'info',
      title: 'Most traffic arrives direct',
      body: 'Customers are typing your URL or using bookmarks — strong brand recall. UTM-tag your campaigns to get accurate attribution.',
    });
  }

  if (topProducts.length > 0 && topProducts[0].qty >= 3) {
    insights.push({
      type: 'success',
      title: `Best seller: ${topProducts[0].name}`,
      body: `Sold ${topProducts[0].qty} units this month. Consider featuring it prominently on the homepage.`,
    });
  }

  if (todayOrderCount === 0 && last30.length > 0) {
    insights.push({
      type: 'info',
      title: 'No orders yet today',
      body: 'Normal variance — nothing to act on unless this persists past your typical peak hours.',
    });
  }

  if (insights.length === 0) {
    insights.push({
      type: 'info',
      title: 'Collecting data',
      body: 'Insights will appear as orders come in. Share UTM-tagged links to track traffic sources.',
    });
  }

  return insights;
}

// ── The brain: read the first-party event spine ───────────────────────────────
// Turns the raw clickstream (Event) + visits (Visit) + orders (Order) into the
// funnel, the top signals, and a few real session journeys — all joined on the
// sessionId thread. Revenue-bearing order statuses (not failed/cancelled/refunded).
const REVENUE_STATUSES = ['paid', 'processing', 'shipped', 'delivered'];

router.get('/journeys', requireAuth, async function(req, res) {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 90);
    const since = new Date(Date.now() - days * 86400000);

    // Funnel = distinct SESSIONS that reached each stage (not raw event counts,
    // so a refresh-happy visitor doesn't inflate a step).
    const STAGES = ['view_item', 'add_to_cart', 'begin_checkout', 'purchase'];

    const [
      sessionAgg, funnelAgg, searches, clicks, sources, revenue, recentPurchases,
    ] = await Promise.all([
      // Total sessions in the window (distinct sessionId across visits).
      Visit.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$sessionId' } },
        { $count: 'sessions' },
      ]),
      // Distinct sessions per funnel stage.
      Event.aggregate([
        { $match: { createdAt: { $gte: since }, type: { $in: STAGES } } },
        { $group: { _id: { type: '$type', s: '$sessionId' } } },
        { $group: { _id: '$_id.type', sessions: { $sum: 1 } } },
      ]),
      // Top search terms (trackSearch fires { search_term }).
      Event.aggregate([
        { $match: { createdAt: { $gte: since }, type: 'search' } },
        { $group: { _id: '$props.search_term', count: { $sum: 1 } } },
        { $match: { _id: { $nin: [null, ''] } } },
        { $sort: { count: -1 } }, { $limit: 15 },
      ]),
      // Most-clicked products from the card_click events.
      Event.aggregate([
        { $match: { createdAt: { $gte: since }, type: 'card_click' } },
        { $group: { _id: '$props.name', count: { $sum: 1 } } },
        { $match: { _id: { $nin: [null, ''] } } },
        { $sort: { count: -1 } }, { $limit: 15 },
      ]),
      // Sessions by traffic source.
      Visit.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$source', sessions: { $addToSet: '$sessionId' } } },
        { $project: { source: '$_id', _id: 0, sessions: { $size: '$sessions' } } },
        { $sort: { sessions: -1 } }, { $limit: 10 },
      ]),
      // Revenue by acquisition source (the money view).
      Order.aggregate([
        { $match: { createdAt: { $gte: since }, status: { $in: REVENUE_STATUSES } } },
        { $group: { _id: '$attribution.source', orders: { $sum: 1 }, revenue: { $sum: '$total' } } },
        { $project: { source: '$_id', _id: 0, orders: 1, revenue: 1 } },
        { $sort: { revenue: -1 } }, { $limit: 10 },
      ]),
      // A handful of real converting sessions to "follow the thread".
      Event.find({ type: 'purchase', createdAt: { $gte: since } })
        .sort({ createdAt: -1 }).limit(5).select('sessionId createdAt').lean(),
    ]);

    const totalSessions = sessionAgg[0]?.sessions || 0;
    const stageMap = Object.fromEntries(funnelAgg.map(s => [s._id, s.sessions]));
    const funnel = [
      { stage: 'Sessions', sessions: totalSessions },
      { stage: 'Viewed a product', sessions: stageMap.view_item || 0 },
      { stage: 'Added to cart', sessions: stageMap.add_to_cart || 0 },
      { stage: 'Began checkout', sessions: stageMap.begin_checkout || 0 },
      { stage: 'Purchased', sessions: stageMap.purchase || 0 },
    ].map((s, i, arr) => ({
      ...s,
      // Conversion vs the top of funnel, and step-over-step retention.
      ofSessions: totalSessions ? Math.round((s.sessions / totalSessions) * 1000) / 10 : 0,
      ofPrev: i === 0 || !arr[i - 1].sessions ? 100 : Math.round((s.sessions / arr[i - 1].sessions) * 1000) / 10,
    }));

    // Reconstruct each sample session's ordered path (bounded).
    const journeys = [];
    for (const p of recentPurchases) {
      const path = await Event.find({ sessionId: p.sessionId })
        .sort({ createdAt: 1 }).limit(40).select('type page props createdAt -_id').lean();
      journeys.push({ sessionId: p.sessionId, at: p.createdAt, steps: path });
    }

    res.json({
      range: { days, since },
      totalSessions,
      funnel,
      topSearches: searches.map(s => ({ term: s._id, count: s.count })),
      topProducts: clicks.map(c => ({ name: c._id, count: c.count })),
      sources,
      revenueBySource: revenue,
      journeys,
    });
  } catch (err) {
    console.error('[insights/journeys]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
