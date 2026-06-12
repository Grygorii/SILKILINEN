const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const Visit = require('../models/Visit');
const Order = require('../models/Order');
const Review = require('../models/Review');
const Cart = require('../models/Cart');

router.use(requireAuth);

const REVENUE_STATUSES = ['paid', 'shipped', 'delivered'];

async function visitorsBetween(from, to) {
  const result = await Visit.aggregate([
    { $match: { createdAt: { $gte: from, $lt: to } } },
    { $group: { _id: '$sessionId' } },
    { $count: 'count' },
  ]);
  return result[0]?.count || 0;
}

async function ordersBetween(from, to) {
  const result = await Order.aggregate([
    { $match: { status: { $in: REVENUE_STATUSES }, createdAt: { $gte: from, $lt: to } } },
    { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: { $ifNull: ['$total', 0] } } } },
  ]);
  return { orders: result[0]?.orders || 0, revenueEUR: result[0]?.revenue || 0 };
}

// GET / — today-so-far pulse stats + yesterday-same-window comparison.
// Mounted by server.js at /api/admin/today.
router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(new Date().setUTCHours(0, 0, 0, 0));
    const dayMs = 24 * 60 * 60 * 1000;
    const yesterdayStart = new Date(todayStart.getTime() - dayMs);
    const yesterdayNow = new Date(now.getTime() - dayMs);

    const [
      visitorsToday,
      today,
      yesterdayVisitors,
      yesterdayOrders,
      pendingFulfilment,
      reviewsPending,
      openCarts,
    ] = await Promise.all([
      visitorsBetween(todayStart, now),
      ordersBetween(todayStart, now),
      visitorsBetween(yesterdayStart, yesterdayNow),
      ordersBetween(yesterdayStart, yesterdayNow),
      Order.countDocuments({ status: { $in: ['paid', 'processing'] } }),
      Review.countDocuments({ status: 'pending' }),
      Cart.countDocuments({ updatedAt: { $gte: new Date(now.getTime() - dayMs) } }),
    ]);

    res.json({
      visitorsToday,
      ordersToday: today.orders,
      revenueTodayEUR: today.revenueEUR,
      pendingFulfilment,
      reviewsPending,
      openCarts,
      yesterday: {
        visitors: yesterdayVisitors,
        orders: yesterdayOrders.orders,
        revenueEUR: yesterdayOrders.revenueEUR,
      },
    });
  } catch (err) {
    console.error('[adminToday] error:', err);
    res.status(500).json({ error: 'Failed to load today stats' });
  }
});

module.exports = router;
