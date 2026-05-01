const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const { requireAuth } = require('../middleware/auth');

router.get('/stats', requireAuth, async function(req, res) {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [thisMonthOrders, lastMonthOrders, allPaidOrders, recentOrders] = await Promise.all([
      Order.find({ status: 'paid', createdAt: { $gte: startOfMonth } }),
      Order.find({ status: 'paid', createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } }),
      Order.find({ status: 'paid' }),
      Order.find({ status: 'paid' }).sort({ createdAt: -1 }).limit(5),
    ]);

    // Revenue
    const revenueThisMonth = thisMonthOrders.reduce((s, o) => s + (o.total || 0), 0);
    const revenueLastMonth = lastMonthOrders.reduce((s, o) => s + (o.total || 0), 0);
    const revenueChange = revenueLastMonth > 0
      ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100
      : null;

    // Orders count
    const ordersThisMonth = thisMonthOrders.length;
    const ordersLastMonth = lastMonthOrders.length;
    const ordersChange = ordersLastMonth > 0
      ? ((ordersThisMonth - ordersLastMonth) / ordersLastMonth) * 100
      : null;

    // AOV
    const aov = allPaidOrders.length
      ? allPaidOrders.reduce((s, o) => s + (o.total || 0), 0) / allPaidOrders.length
      : 0;

    // Last 30 days daily revenue chart
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    const last30Orders = allPaidOrders.filter(o => new Date(o.createdAt) >= thirtyDaysAgo);
    const dailyMap = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(thirtyDaysAgo);
      d.setDate(d.getDate() + i);
      dailyMap[d.toISOString().slice(0, 10)] = 0;
    }
    for (const o of last30Orders) {
      const day = new Date(o.createdAt).toISOString().slice(0, 10);
      if (dailyMap[day] !== undefined) dailyMap[day] += o.total || 0;
    }
    const salesChart = Object.entries(dailyMap).map(([date, revenue]) => ({ date, revenue }));

    // Top 5 products by quantity sold this month
    const productTotals = {};
    for (const o of thisMonthOrders) {
      for (const item of (o.items || [])) {
        const key = item.name || 'Unknown';
        productTotals[key] = (productTotals[key] || 0) + (item.quantity || 1);
      }
    }
    const topProducts = Object.entries(productTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, qty]) => ({ name, qty }));

    // Geographic distribution
    const countryMap = {};
    for (const o of allPaidOrders) {
      const c = o.shippingAddress?.country || 'Unknown';
      countryMap[c] = (countryMap[c] || 0) + 1;
    }
    const geoDistribution = Object.entries(countryMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([country, count]) => ({ country, count }));

    res.json({
      revenueThisMonth,
      revenueLastMonth,
      revenueChange,
      ordersThisMonth,
      ordersLastMonth,
      ordersChange,
      aov,
      recentOrders,
      topProducts,
      salesChart,
      geoDistribution,
      totalOrders: allPaidOrders.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', requireAuth, async function(req, res) {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
