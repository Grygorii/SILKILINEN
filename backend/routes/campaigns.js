const express = require('express');
const router = express.Router();
const Campaign = require('../models/Campaign');
const Order = require('../models/Order');
const Visit = require('../models/Visit');
const Expense = require('../models/Expense');
const { requireAuth } = require('../middleware/auth');

function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const PAID_STATUSES = ['paid', 'processing', 'shipped', 'delivered'];

async function getCampaignStats(campaign, dateRange) {
  const matchFilter = { status: { $in: PAID_STATUSES } };
  if (dateRange?.from) matchFilter.createdAt = { $gte: dateRange.from };
  if (dateRange?.to)   matchFilter.createdAt = { ...matchFilter.createdAt, $lte: dateRange.to };

  const [orders, visitCount] = await Promise.all([
    Order.find({
      ...matchFilter,
      $or: [
        { 'utm.campaign': campaign.slug },
        { 'attribution.campaign': campaign.slug },
      ],
    }).lean(),
    Visit.aggregate([
      { $match: { 'utm.campaign': campaign.slug, ...(dateRange?.from ? { createdAt: { $gte: dateRange.from } } : {}) } },
      { $group: { _id: '$sessionId' } },
      { $count: 'total' },
    ]),
  ]);

  const revenue    = orders.reduce((s, o) => s + (o.total || 0), 0);
  const refunds    = orders.reduce((s, o) => s + (o.refundedAmount || 0), 0);
  const netRevenue = revenue - refunds;
  const spend      = campaign.spend || 0;
  const visits     = visitCount[0]?.total || 0;

  // Creative breakdown
  const creativeMap = {};
  for (const o of orders) {
    const key = o.utm?.content || 'unknown';
    if (!creativeMap[key]) creativeMap[key] = { utmContent: key, orders: 0, revenue: 0 };
    creativeMap[key].orders++;
    creativeMap[key].revenue += (o.total || 0) - (o.refundedAmount || 0);
  }

  // Product breakdown
  const productMap = {};
  for (const o of orders) {
    for (const item of (o.items || [])) {
      const key = String(item.productId || item.name);
      if (!productMap[key]) productMap[key] = { productId: key, name: item.name, units: 0, revenue: 0 };
      productMap[key].units   += item.quantity || 1;
      productMap[key].revenue += (item.price || 0) * (item.quantity || 1);
    }
  }

  return {
    campaign: {
      _id:     campaign._id,
      name:    campaign.name,
      channel: campaign.channel,
      status:  campaign.status,
      spend:   campaign.spend,
      budget:  campaign.budget,
    },
    visits,
    clicks:           visits,
    orders:           orders.length,
    revenue,
    refunds,
    netRevenue,
    conversionRate:   visits > 0 ? Math.round((orders.length / visits) * 1000) / 10 : null,
    averageOrderValue: orders.length > 0 ? revenue / orders.length : null,
    costPerOrder:      orders.length > 0 && spend > 0 ? spend / orders.length : null,
    roas:              spend > 0 && netRevenue > 0 ? Math.round((netRevenue / spend) * 100) / 100 : null,
    topProducts: Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    topCreatives: Object.values(creativeMap).sort((a, b) => b.orders - a.orders),
    attributedOrders: orders.map(o => ({
      _id:         o._id,
      orderNumber: o.orderNumber,
      createdAt:   o.createdAt,
      total:       o.total,
      status:      o.status,
      customerEmail: o.customerEmail,
      utmContent:  o.utm?.content,
      firstItem:   o.items?.[0]?.name,
    })),
  };
}

// ── Campaign list (admin) ─────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = status;
    const campaigns = await Campaign.find(filter).sort({ createdAt: -1 }).lean();
    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Create campaign ───────────────────────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, channel, startDate, endDate, budget, targetProducts, creatives, notes } = req.body;
    if (!name || !channel) return res.status(400).json({ error: 'name and channel required' });

    let slug = slugify(name);
    // Ensure unique slug
    const existing = await Campaign.findOne({ slug }).lean();
    if (existing) slug = `${slug}-${Date.now()}`;

    const campaign = await Campaign.create({
      name, slug, channel,
      startDate: startDate || undefined,
      endDate:   endDate   || undefined,
      budget:    budget    || 0,
      spend:     0,
      targetProducts: targetProducts || [],
      creatives:  creatives  || [],
      notes:      notes      || '',
      createdBy:  req.user?.userId,
    });

    res.status(201).json(campaign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get single campaign + stats ───────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id).lean();
    if (!campaign) return res.status(404).json({ error: 'Not found' });

    const from = req.query.from ? new Date(req.query.from) : undefined;
    const to   = req.query.to   ? new Date(req.query.to)   : undefined;
    const stats = await getCampaignStats(campaign, { from, to });

    res.json({ ...campaign, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Update campaign ───────────────────────────────────────────────────────────
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const allowed = ['name', 'channel', 'status', 'startDate', 'endDate', 'budget',
                     'targetProducts', 'creatives', 'notes'];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    const campaign = await Campaign.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!campaign) return res.status(404).json({ error: 'Not found' });
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Add spend update ──────────────────────────────────────────────────────────
router.post('/:id/spend', requireAuth, async (req, res) => {
  try {
    const { amount, note } = req.body;
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }
    const campaign = await Campaign.findByIdAndUpdate(
      req.params.id,
      {
        $inc:  { spend: amount },
        $push: { spendUpdates: { amount, note: note || '', date: new Date() } },
      },
      { new: true }
    );
    if (!campaign) return res.status(404).json({ error: 'Not found' });

    // Auto-create a Finance Expense entry so spend appears in P&L without manual entry
    await Expense.create({
      amount,
      date: new Date(),
      category: 'marketing_ads',
      description: `Ad spend — ${campaign.name}${note ? ': ' + note : ''}`,
      notes: note || undefined,
      isAutomatic: true,
      sourceRef: `campaign:${campaign._id}`,
      taxDeductible: true,
      createdBy: req.user?.userId || 'admin',
    }).catch(err => console.error('[campaigns/spend] expense creation failed:', err.message));

    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Toggle status ─────────────────────────────────────────────────────────────
router.put('/:id/status', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['draft', 'active', 'paused', 'ended'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const campaign = await Campaign.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!campaign) return res.status(404).json({ error: 'Not found' });
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Duplicate campaign ────────────────────────────────────────────────────────
router.post('/:id/duplicate', requireAuth, async (req, res) => {
  try {
    const src = await Campaign.findById(req.params.id).lean();
    if (!src) return res.status(404).json({ error: 'Not found' });

    const baseName = `${src.name} (copy)`;
    let slug = slugify(baseName);
    const ex = await Campaign.findOne({ slug }).lean();
    if (ex) slug = `${slug}-${Date.now()}`;

    const { _id, createdAt, updatedAt, spend, spendUpdates, ...rest } = src;
    const dup = await Campaign.create({
      ...rest,
      name:         baseName,
      slug,
      status:       'draft',
      spend:        0,
      spendUpdates: [],
      createdBy:    req.user?.userId,
    });
    res.status(201).json(dup);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, getCampaignStats };
