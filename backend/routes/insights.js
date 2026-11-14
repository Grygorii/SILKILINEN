const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Event = require('../models/Event');
const Visit = require('../models/Visit');
const { requireAuth } = require('../middleware/auth');
const { loadEvidence } = require('../services/commerceEvidence');
const { stagesFromEvidence } = require('../services/funnel');

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

// Session replay uses the same order-ledger/browser-link evidence as the
// conversion funnel. A success-page event is optional browser telemetry, not
// proof of a paid order, so we never manufacture one from a webhook.
router.get('/journeys', requireAuth, async function(req, res) {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 90);
    const now = new Date();
    const since = new Date(now.getTime() - days * 86400000);
    const range = { $gte: since, $lt: now };

    const [evidence, searches, clicks] = await Promise.all([
      loadEvidence(days, { now }),
      Event.aggregate([
        { $match: { createdAt: range, type: 'search' } },
        { $group: { _id: '$props.search_term', count: { $sum: 1 } } },
        { $match: { _id: { $nin: [null, ''] } } },
        { $sort: { count: -1 } }, { $limit: 15 },
      ]),
      Event.aggregate([
        { $match: { createdAt: range, type: 'card_click' } },
        { $group: { _id: '$props.name', count: { $sum: 1 } } },
        { $match: { _id: { $nin: [null, ''] } } },
        { $sort: { count: -1 } }, { $limit: 15 },
      ]),
    ]);

    const totalSessions = evidence.stage.sessions.size;
    const funnel = stagesFromEvidence(evidence).map(stage => ({
      key: stage.key,
      stage: stage.label,
      sessions: stage.count,
      ofSessions: totalSessions ? Math.round(stage.count / totalSessions * 1000) / 10 : 0,
      ofPrev: stage.rate,
      reliability: stage.reliability,
    }));
    const sources = evidence.sources
      .filter(source => source.visitors > 0)
      .slice(0, 10)
      .map(source => ({ source: source.source, label: source.displayLabel, sessions: source.visitors }));
    const revenueBySource = evidence.sources
      .filter(source => source.attributedOrders > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map(source => ({
        source: source.source,
        label: source.displayLabel,
        orders: source.attributedOrders,
        revenue: Math.round(source.revenue) / 100,
      }));

    const outcome = req.query.outcome === 'purchased' ? 'purchased' : 'abandoned';
    const replayStages = [
      { query: 'reached_payment', key: 'startedPayment', next: 'purchased' },
      { query: 'begin_checkout', key: 'reachedCheckout', next: 'startedPayment' },
      { query: 'add_to_cart', key: 'addedToCart', next: 'reachedCheckout' },
      { query: 'view_item', key: 'viewedProduct', next: 'addedToCart' },
    ];
    const selectedStage = replayStages.find(stage => stage.query === req.query.stage);
    const paidSessions = [...evidence.stage.purchased.entries()]
      .map(([sessionId, times]) => ({ sessionId, at: new Date(Math.max(...times)) }))
      .sort((a, b) => b.at - a.at);
    const completedIds = new Set(paidSessions.map(item => item.sessionId));

    let sampleSessions;
    if (outcome === 'purchased') {
      sampleSessions = paidSessions.slice(0, 8);
    } else {
      const candidates = new Map();
      for (const stage of selectedStage ? [selectedStage] : replayStages) {
        for (const [sessionId, times] of evidence.stage[stage.key]) {
          if (!evidence.browsers.has(sessionId) || completedIds.has(sessionId) || candidates.has(sessionId)) continue;
          const firstAt = Math.min(...times);
          const progressed = (evidence.stage[stage.next].get(sessionId) || []).some(at => at >= firstAt);
          if (!progressed) candidates.set(sessionId, { sessionId, at: new Date(Math.max(...times)) });
        }
      }
      sampleSessions = [...candidates.values()].sort((a, b) => b.at - a.at).slice(0, 8);
    }

    const journeys = [];
    for (const sample of sampleSessions) {
      const [eventSteps, visitSteps] = await Promise.all([
        Event.find({ sessionId: sample.sessionId, createdAt: range })
          .sort({ createdAt: -1 }).limit(40).select('type page props createdAt -_id').lean(),
        Visit.find({ sessionId: sample.sessionId, createdAt: range })
          .sort({ createdAt: -1 }).limit(40).select('page productId createdAt -_id').lean(),
      ]);
      const steps = [
        ...visitSteps.map(visit => ({
          type: 'page_view', page: visit.page, props: visit.productId ? { productId: String(visit.productId) } : {}, createdAt: visit.createdAt,
        })),
        ...eventSteps,
      ]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 40)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      if (outcome === 'purchased') {
        steps.push({ type: 'paid_order', props: { source: 'order_ledger' }, createdAt: sample.at });
        steps.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      }
      journeys.push({ sessionId: sample.sessionId, at: sample.at, steps, outcome });
    }

    res.json({
      range: { days, since },
      outcome,
      totalSessions,
      reporting: {
        paidOrders: evidence.summary.orders,
        linkedOrders: evidence.summary.linkedOrders,
        unlinkedOrders: evidence.summary.unlinkedOrders,
        manualOrders: evidence.summary.manualOrders,
        netRevenueEUR: evidence.summary.netRevenueEUR,
      },
      funnel,
      topSearches: searches.map(search => ({ term: search._id, count: search.count })),
      topProducts: clicks.map(click => ({ name: click._id, count: click.count })),
      sources,
      revenueBySource,
      journeys,
    });
  } catch (err) {
    console.error('[insights/journeys]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
