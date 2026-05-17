const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const Order = require('../models/Order');
const Product = require('../models/Product');
const Expense = require('../models/Expense');
const Receipt = require('../models/Receipt');
const { requireAuth } = require('../middleware/auth');
const { EXPENSE_CATEGORIES } = require('../models/Expense');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const PAID_STATUSES = ['paid', 'processing', 'shipped', 'delivered', 'refunded', 'partially_refunded'];

// ── Helper: upload to Cloudinary ──────────────────────────────────────────────
function uploadToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    }).end(buffer);
  });
}

// ── Helper: date range for "last 30 days" / "current month" ──────────────────
function monthBounds(offsetMonths = 0) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getFullYear(), now.getMonth() - offsetMonths, 1));
  const end   = new Date(Date.UTC(now.getFullYear(), now.getMonth() - offsetMonths + 1, 0, 23, 59, 59, 999));
  return { start, end };
}

function last30() {
  const end   = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 30);
  return { start, end };
}

// ── GET /api/admin/finance/overview ──────────────────────────────────────────
router.get('/overview', requireAuth, async (req, res) => {
  try {
    const { start: mStart, end: mEnd }       = monthBounds(0);
    const { start: pmStart, end: pmEnd }     = monthBounds(1);
    const { start: l30Start, end: l30End }   = last30();
    const { start: pl30Start, end: pl30End } = (() => {
      const end   = new Date(l30Start);
      const start = new Date(end);
      start.setDate(start.getDate() - 30);
      return { start, end };
    })();

    // ── Revenue from orders ────────────────────────────────────────────────
    const [mOrders, pmOrders, l30Orders, pl30Orders] = await Promise.all([
      Order.find({ status: { $in: PAID_STATUSES }, createdAt: { $gte: mStart, $lte: mEnd } }).lean(),
      Order.find({ status: { $in: PAID_STATUSES }, createdAt: { $gte: pmStart, $lte: pmEnd } }).lean(),
      Order.find({ status: { $in: PAID_STATUSES }, createdAt: { $gte: l30Start, $lte: l30End } }).lean(),
      Order.find({ status: { $in: PAID_STATUSES }, createdAt: { $gte: pl30Start, $lte: pl30End } }).lean(),
    ]);

    function sumRevenue(orders) { return orders.reduce((s, o) => s + (o.total || 0), 0); }
    function sumCosts(orders) {
      return {
        stripeFees:   orders.reduce((s, o) => s + (o.costs?.stripeFee || 0), 0),
        cogs:         orders.reduce((s, o) => s + (o.costs?.cogs || 0), 0),
        shippingCost: orders.reduce((s, o) => s + (o.costs?.shippingCost || 0), 0),
        refunded:     orders.reduce((s, o) => s + (o.refundedAmount || o.costs?.refundedAmount || 0), 0),
      };
    }

    // ── Expenses ───────────────────────────────────────────────────────────
    const [mExpenses, l30Expenses] = await Promise.all([
      Expense.find({ date: { $gte: mStart, $lte: mEnd } }).lean(),
      Expense.find({ date: { $gte: l30Start, $lte: l30End } }).lean(),
    ]);

    const mRevenue = sumRevenue(mOrders);
    const mCosts   = sumCosts(mOrders);
    const mMktSpend   = mExpenses.filter(e => e.category === 'marketing_ads').reduce((s, e) => s + e.amount, 0);
    const mOtherExp   = mExpenses.filter(e => !['marketing_ads','refunds'].includes(e.category)).reduce((s, e) => s + e.amount, 0);
    const mNetProfit  = mRevenue - mCosts.stripeFees - mCosts.cogs - mCosts.shippingCost - mRevenue * 0 /* placeholder */ - mMktSpend - mOtherExp - mCosts.refunded;

    const l30Revenue = sumRevenue(l30Orders);
    const pl30Revenue = sumRevenue(pl30Orders);

    // ── Per-order profitability (recent 50) ────────────────────────────────
    const recentOrders = await Order.find({ status: { $in: PAID_STATUSES } })
      .sort({ createdAt: -1 }).limit(50)
      .populate('items.productId', 'name costing')
      .lean();

    const perOrderRows = recentOrders.map(o => {
      const stripeFee   = o.costs?.stripeFee    ?? null;
      const shippingCost= o.costs?.shippingCost ?? null;
      const cogs        = o.costs?.cogs         ?? null;
      const refunded    = o.refundedAmount || o.costs?.refundedAmount || 0;
      const missingFields = [];
      if (shippingCost === null) missingFields.push('shipping cost');
      if (stripeFee === null)    missingFields.push('Stripe fee');
      if (cogs === null)         missingFields.push('product cost (COGS)');

      let netProfit = null;
      if (missingFields.length === 0) {
        netProfit = (o.total || 0) - (stripeFee || 0) - (shippingCost || 0) - (cogs || 0) - refunded;
      }
      const margin = netProfit !== null && o.total ? netProfit / o.total : null;

      return {
        _id:           o._id,
        orderNumber:   o.orderNumber,
        createdAt:     o.createdAt,
        total:         o.total || 0,
        cogs,
        stripeFee,
        shippingCost,
        refunded,
        netProfit,
        margin,
        missingFields,
        items:         o.items?.map(i => i.name),
      };
    });

    // ── Expense breakdown by category (last 30 days) ─────────────────────
    const catBreakdown = {};
    for (const e of l30Expenses) {
      if (!catBreakdown[e.category]) catBreakdown[e.category] = { category: e.category, amount: 0, count: 0 };
      catBreakdown[e.category].amount += e.amount;
      catBreakdown[e.category].count  += 1;
    }
    const expenseBreakdown = Object.values(catBreakdown).sort((a, b) => b.amount - a.amount);

    // ── Prompts: categories with no entries this month ────────────────────
    const softwareCategory = catBreakdown['software_saas'];
    const prompts = [];
    if (!softwareCategory || softwareCategory.amount === 0) {
      prompts.push({ key: 'software_saas', message: "You haven't logged any software costs this month. Want to add them?", category: 'software_saas' });
    }

    res.json({
      currentMonth: {
        revenue: mRevenue,
        orderCount: mOrders.length,
        avgOrder: mOrders.length > 0 ? mRevenue / mOrders.length : 0,
        ...mCosts,
        marketingSpend: mMktSpend,
        otherExpenses:  mOtherExp,
        netProfit: mNetProfit,
      },
      last30: {
        revenue: l30Revenue,
        orderCount: l30Orders.length,
        avgOrder: l30Orders.length > 0 ? l30Revenue / l30Orders.length : 0,
        revenueDelta: l30Revenue - pl30Revenue,
        orderDelta: l30Orders.length - pl30Orders.length,
      },
      perOrderRows,
      expenseBreakdown,
      prompts,
    });
  } catch (err) {
    console.error('[finance/overview]', err.message);
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/admin/finance/action-items ──────────────────────────────────────
router.get('/action-items', requireAuth, async (req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const items = [];

    // Orders without shipping cost entered, older than 7 days
    const ordersNoShipping = await Order.find({
      status: { $in: ['paid', 'processing', 'shipped', 'delivered'] },
      createdAt: { $lte: sevenDaysAgo },
      'costs.shippingCost': { $exists: false },
    }).select('orderNumber _id').limit(10).lean();
    if (ordersNoShipping.length > 0) {
      items.push({
        key:     'missing_shipping_cost',
        type:    'warning',
        message: `${ordersNoShipping.length} order${ordersNoShipping.length > 1 ? 's' : ''} shipped without shipping cost entered`,
        link:    '/admin/finance',
        orderIds: ordersNoShipping.map(o => o._id),
      });
    }

    // Products with no costing data
    const productsNoCost = await Product.find({
      status: { $in: ['active', 'sold_out'] },
      'costing.totalUnitCost': { $exists: false },
    }).select('name _id').limit(10).lean();
    if (productsNoCost.length > 0) {
      items.push({
        key:     'missing_product_costing',
        type:    'warning',
        message: `${productsNoCost.length} product${productsNoCost.length > 1 ? 's' : ''} missing cost data`,
        link:    '/admin/products',
        products: productsNoCost.map(p => ({ _id: p._id, name: p.name })),
      });
    }

    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/admin/finance/expenses ──────────────────────────────────────────
router.get('/expenses', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50, category, search, from, to, hasReceipt, linkedToOrder } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to)   filter.date.$lte = new Date(to + 'T23:59:59Z');
    }
    if (hasReceipt === 'true')  filter.receiptId = { $exists: true };
    if (linkedToOrder === 'true') filter.orderIds = { $not: { $size: 0 } };
    if (search) {
      const re = new RegExp(search, 'i');
      filter.$or = [{ description: re }, { notes: re }];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [expenses, total, yearTotal] = await Promise.all([
      Expense.find(filter).sort({ date: -1 }).skip(skip).limit(Number(limit))
        .populate('receiptId', 'fileUrl fileName description')
        .lean(),
      Expense.countDocuments(filter),
      Expense.aggregate([
        { $match: { date: { $gte: new Date(new Date().getFullYear() + '-01-01') } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    res.json({
      expenses,
      total,
      pages: Math.ceil(total / Number(limit)),
      yearTotal: yearTotal[0]?.total || 0,
      categories: EXPENSE_CATEGORIES,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/admin/finance/expenses ─────────────────────────────────────────
router.post('/expenses', requireAuth, async (req, res) => {
  try {
    const { amount, date, category, description, notes, orderIds, receiptId, isRecurring, recurringFrequency, taxDeductible } = req.body;
    if (!amount || !date || !category || !description) {
      return res.status(400).json({ error: 'amount, date, category, and description are required' });
    }
    const expense = await Expense.create({
      amount: Number(amount),
      date:   new Date(date),
      category,
      description,
      notes: notes || undefined,
      orderIds: orderIds || [],
      receiptId: receiptId || undefined,
      isRecurring: !!isRecurring,
      recurringFrequency: isRecurring ? recurringFrequency : null,
      taxDeductible: taxDeductible !== false,
      createdBy: req.user?.userId || 'admin',
    });
    res.status(201).json(expense);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/admin/finance/expenses/:id ───────────────────────────────────────
router.put('/expenses/:id', requireAuth, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ error: 'Not found' });
    if (expense.isAutomatic) return res.status(403).json({ error: 'Auto-generated entries cannot be edited here. Edit via the source (Marketing tab or Stripe).' });

    const allowed = ['amount','date','category','description','notes','orderIds','receiptId','isRecurring','recurringFrequency','taxDeductible'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) expense[key] = req.body[key];
    }
    await expense.save();
    res.json(expense);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/admin/finance/expenses/:id ────────────────────────────────────
router.delete('/expenses/:id', requireAuth, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ error: 'Not found' });
    if (expense.isAutomatic) return res.status(403).json({ error: 'Auto-generated entries cannot be deleted here.' });
    await expense.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /api/admin/finance/orders/:id/shipping-cost ────────────────────────
// Update shipping cost on a specific order directly from Finance Overview modal
router.patch('/orders/:id/shipping-cost', requireAuth, async (req, res) => {
  try {
    const { shippingCost, notes } = req.body;
    if (shippingCost === undefined || shippingCost === null) {
      return res.status(400).json({ error: 'shippingCost required' });
    }
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { $set: { 'costs.shippingCost': Number(shippingCost), 'costs.shippingCostNotes': notes || '' } },
      { new: true }
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ ok: true, costs: order.costs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/admin/finance/receipts ──────────────────────────────────────────
router.get('/receipts', requireAuth, async (req, res) => {
  try {
    const receipts = await Receipt.find().sort({ createdAt: -1 }).limit(100).lean();
    res.json(receipts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/admin/finance/receipts ─────────────────────────────────────────
router.post('/receipts', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const result = await uploadToCloudinary(req.file.buffer, {
      folder: 'silkilinen/receipts',
      resource_type: 'auto',
    });

    const { description, vendor, totalOnReceipt, orderIds, expenseIds } = req.body;
    const receipt = await Receipt.create({
      fileUrl:    result.secure_url,
      fileName:   req.file.originalname,
      fileSize:   req.file.size,
      mimeType:   req.file.mimetype,
      cloudinaryPublicId: result.public_id,
      uploadedBy: req.user?.userId || 'admin',
      description: description || undefined,
      vendor:      vendor || undefined,
      totalOnReceipt: totalOnReceipt ? Number(totalOnReceipt) : undefined,
      orderIds:   orderIds ? (Array.isArray(orderIds) ? orderIds : [orderIds]) : [],
      expenseIds: expenseIds ? (Array.isArray(expenseIds) ? expenseIds : [expenseIds]) : [],
    });

    res.status(201).json(receipt);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/admin/finance/receipts/:id ──────────────────────────────────────
router.put('/receipts/:id', requireAuth, async (req, res) => {
  try {
    const receipt = await Receipt.findById(req.params.id);
    if (!receipt) return res.status(404).json({ error: 'Not found' });

    const allowed = ['description','vendor','totalOnReceipt','orderIds','expenseIds'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) receipt[key] = req.body[key];
    }
    await receipt.save();
    res.json(receipt);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/admin/finance/receipts/:id ────────────────────────────────────
router.delete('/receipts/:id', requireAuth, async (req, res) => {
  try {
    const receipt = await Receipt.findById(req.params.id);
    if (!receipt) return res.status(404).json({ error: 'Not found' });
    if (receipt.cloudinaryPublicId) {
      await cloudinary.uploader.destroy(receipt.cloudinaryPublicId, { resource_type: 'raw' }).catch(() => {});
    }
    await receipt.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/admin/finance/reports ───────────────────────────────────────────
router.get('/reports', requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const { start, end } = monthBounds(i);
      months.push({ start, end, label: start.toLocaleDateString('en-IE', { month: 'short', year: 'numeric' }) });
    }

    // ── Monthly P&L ────────────────────────────────────────────────────────
    const monthlyPL = await Promise.all(months.map(async ({ start, end, label }) => {
      const [orders, expenses] = await Promise.all([
        Order.find({ status: { $in: PAID_STATUSES }, createdAt: { $gte: start, $lte: end } }).lean(),
        Expense.find({ date: { $gte: start, $lte: end } }).lean(),
      ]);

      const revenue   = orders.reduce((s, o) => s + (o.total || 0), 0);
      const refunds   = orders.reduce((s, o) => s + (o.refundedAmount || 0), 0);
      const stripeFees= orders.reduce((s, o) => s + (o.costs?.stripeFee || 0), 0);
      const cogs      = orders.reduce((s, o) => s + (o.costs?.cogs || 0), 0);
      const shippingCosts = orders.reduce((s, o) => s + (o.costs?.shippingCost || 0), 0);
      const expenseTotal  = expenses.reduce((s, e) => s + e.amount, 0);
      const netRevenue    = revenue - refunds;
      const netProfit     = netRevenue - stripeFees - cogs - shippingCosts - expenseTotal;

      return { label, revenue, refunds, netRevenue, stripeFees, cogs, shippingCosts, expenseTotal, netProfit, orderCount: orders.length };
    }));

    // ── Margin by product (last 90 days) ──────────────────────────────────
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const recentOrders = await Order.find({
      status: { $in: PAID_STATUSES },
      createdAt: { $gte: ninetyDaysAgo },
    }).lean();

    const productMap = {};
    for (const o of recentOrders) {
      for (const item of (o.items || [])) {
        const key = String(item.productId || item.name);
        if (!productMap[key]) productMap[key] = { productId: item.productId, name: item.name, units: 0, revenue: 0, cogs: 0 };
        productMap[key].units   += item.quantity || 1;
        productMap[key].revenue += (item.price || 0) * (item.quantity || 1);
      }
    }

    // Populate product costing
    const productIds = Object.values(productMap).map(p => p.productId).filter(Boolean);
    const products = await Product.find({ _id: { $in: productIds } }).select('name costing').lean();
    const productCostMap = {};
    for (const p of products) {
      productCostMap[String(p._id)] = p.costing?.totalUnitCost;
    }
    for (const row of Object.values(productMap)) {
      const costPerUnit = productCostMap[String(row.productId)] ?? null;
      row.cogs   = costPerUnit !== null ? costPerUnit * row.units : null;
      row.margin = row.cogs !== null && row.revenue > 0 ? (row.revenue - row.cogs) / row.revenue : null;
    }
    const marginByProduct = Object.values(productMap).sort((a, b) => {
      if (b.margin === null) return -1;
      if (a.margin === null) return 1;
      return b.margin - a.margin;
    });

    // ── Margin by acquisition source ──────────────────────────────────────
    const sourceMap = {};
    for (const o of recentOrders) {
      const source = o.utm?.source || o.attribution?.source || 'direct';
      if (!sourceMap[source]) sourceMap[source] = { source, orders: 0, revenue: 0, cogs: 0 };
      sourceMap[source].orders  += 1;
      sourceMap[source].revenue += o.total || 0;
      sourceMap[source].cogs    += o.costs?.cogs || 0;
    }
    const marginBySource = Object.values(sourceMap).map(row => ({
      ...row,
      margin: row.revenue > 0 ? (row.revenue - row.cogs) / row.revenue : null,
    })).sort((a, b) => b.revenue - a.revenue);

    // ── Anomaly flags ─────────────────────────────────────────────────────
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [ordersNoShipping, productsNoCost] = await Promise.all([
      Order.find({
        status: { $in: ['paid', 'processing', 'shipped', 'delivered'] },
        createdAt: { $lte: sevenDaysAgo },
        'costs.shippingCost': { $exists: false },
      }).select('orderNumber _id createdAt').limit(20).lean(),
      Product.find({ status: { $in: ['active', 'sold_out'] }, 'costing.totalUnitCost': { $exists: false } })
        .select('name _id').lean(),
    ]);

    // Months with revenue but zero expenses
    const anomalies = [];
    if (ordersNoShipping.length > 0) {
      anomalies.push({ type: 'missing_shipping_cost', message: `${ordersNoShipping.length} orders without shipping cost entered (>7 days old)`, orders: ordersNoShipping });
    }
    if (productsNoCost.length > 0) {
      anomalies.push({ type: 'missing_product_cost', message: `${productsNoCost.length} active products with no cost data`, products: productsNoCost });
    }
    // Check months with orders but zero total expenses
    for (const m of monthlyPL.slice(-6)) {
      if (m.orderCount > 0 && m.expenseTotal === 0) {
        anomalies.push({ type: 'no_expenses_in_month', message: `${m.label} — ${m.orderCount} orders but no expenses logged. Data likely incomplete.` });
      }
    }

    res.json({ monthlyPL, marginByProduct, marginBySource, anomalies });
  } catch (err) {
    console.error('[finance/reports]', err.message);
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
