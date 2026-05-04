const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const { requireAuth } = require('../middleware/auth');
const {
  sendProcessingEmail,
  sendShippedEmail,
  sendDeliveredEmail,
  sendCancelledEmail,
} = require('../services/email');

const VALID_STATUSES = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded'];

const STATUS_EMAIL_FNS = {
  processing: sendProcessingEmail,
  shipped: sendShippedEmail,
  delivered: sendDeliveredEmail,
  cancelled: sendCancelledEmail,
};

// GET /api/orders/stats — dashboard metrics
router.get('/stats', requireAuth, async function(req, res) {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [thisMonthOrders, lastMonthOrders, allPaidOrders, recentOrders] = await Promise.all([
      Order.find({ status: 'paid', createdAt: { $gte: startOfMonth } }),
      Order.find({ status: 'paid', createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } }),
      Order.find({ status: { $nin: ['pending', 'failed'] } }),
      Order.find({ status: { $nin: ['pending', 'failed'] } }).sort({ createdAt: -1 }).limit(5),
    ]);

    const revenueThisMonth = thisMonthOrders.reduce((s, o) => s + (o.total || 0), 0);
    const revenueLastMonth = lastMonthOrders.reduce((s, o) => s + (o.total || 0), 0);
    const revenueChange = revenueLastMonth > 0
      ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100
      : null;

    const ordersThisMonth = thisMonthOrders.length;
    const ordersLastMonth = lastMonthOrders.length;
    const ordersChange = ordersLastMonth > 0
      ? ((ordersThisMonth - ordersLastMonth) / ordersLastMonth) * 100
      : null;

    const aov = allPaidOrders.length
      ? allPaidOrders.reduce((s, o) => s + (o.total || 0), 0) / allPaidOrders.length
      : 0;

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
      revenueThisMonth, revenueLastMonth, revenueChange,
      ordersThisMonth, ordersLastMonth, ordersChange,
      aov, recentOrders, topProducts, salesChart, geoDistribution,
      totalOrders: allPaidOrders.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/orders/recent-activity
router.get('/recent-activity', requireAuth, async function(req, res) {
  try {
    const orders = await Order.find({ status: { $nin: ['pending', 'failed'] } })
      .sort({ createdAt: -1 }).limit(10);
    const activity = orders.map(o => ({
      item: o.items?.[0]?.name || 'a product',
      createdAt: o.createdAt,
    }));
    res.json(activity);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/orders — list with optional filters
router.get('/', requireAuth, async function(req, res) {
  try {
    const { status, search, from, to, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (status && status !== 'all') {
      const statuses = status.split(',').filter(s => VALID_STATUSES.includes(s));
      if (statuses.length) filter.status = { $in: statuses };
    }
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(escaped, 'i');
      filter.$or = [{ customerName: re }, { customerEmail: re }];
    }
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to + 'T23:59:59.999Z');
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Order.countDocuments(filter),
    ]);

    res.json({ orders, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/orders/:id — single order full detail
router.get('/:id', requireAuth, async function(req, res) {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/orders/:id/status — change status + optional email notification
router.put('/:id/status', requireAuth, async function(req, res) {
  try {
    const { status, note, sendEmail = true } = req.body;
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const update = {
      status,
      $push: {
        statusHistory: {
          status,
          note: note || '',
          changedBy: req.user.userId,
          timestamp: new Date(),
        },
      },
    };
    if (status === 'shipped') update.shippedAt = new Date();
    if (status === 'delivered') update.deliveredAt = new Date();

    const order = await Order.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!order) return res.status(404).json({ error: 'Not found' });

    if (sendEmail && STATUS_EMAIL_FNS[status] && order.customerEmail) {
      STATUS_EMAIL_FNS[status](order).catch(err =>
        console.error(`[EMAIL] Status ${status} email failed:`, err.message)
      );
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/orders/:id/tracking
router.put('/:id/tracking', requireAuth, async function(req, res) {
  try {
    const { trackingNumber, trackingUrl, carrier, estimatedDelivery } = req.body;
    const update = {};
    if (trackingNumber !== undefined) update.trackingNumber = trackingNumber;
    if (trackingUrl !== undefined) update.trackingUrl = trackingUrl;
    if (carrier !== undefined) update.carrier = carrier;
    if (estimatedDelivery !== undefined) {
      update.estimatedDelivery = estimatedDelivery ? new Date(estimatedDelivery) : null;
    }

    const order = await Order.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!order) return res.status(404).json({ error: 'Not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/orders/:id/notes
router.put('/:id/notes', requireAuth, async function(req, res) {
  try {
    const { customerNote, internalNote } = req.body;
    const update = {};
    if (customerNote !== undefined) update.customerNote = customerNote;
    if (internalNote !== undefined) update.internalNote = internalNote;

    const order = await Order.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!order) return res.status(404).json({ error: 'Not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
