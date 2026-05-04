const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
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
    res.status(500).json({ error: err.message });
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

module.exports = router;
