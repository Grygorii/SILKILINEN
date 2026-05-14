const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Visit = require('../models/Visit');

const TIMEZONE = 'Europe/Dublin';

// Source → display label mapping
const SOURCE_LABELS = {
  instagram: 'Instagram',
  facebook:  'Facebook',
  pinterest: 'Pinterest',
  tiktok:    'TikTok',
  google:    'Google',
  twitter:   'Twitter / X',
  referral:  'Referral',
  direct:    'Direct',
};

function displayLabel(source) {
  return SOURCE_LABELS[source] || (source
    ? source.charAt(0).toUpperCase() + source.slice(1)
    : 'Unknown');
}

// ── Time helpers ──────────────────────────────────────────────────────────────

function getDublinDateStr(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(date);
}

// Given a Dublin date string like "2026-05-08", return UTC Date for midnight Dublin time.
// Dublin is UTC+0 (winter) or UTC+1 (summer), so we try both offsets.
function startOfDublinDay(dublinDateStr) {
  const [y, m, d] = dublinDateStr.split('-').map(Number);
  for (const offsetH of [0, 1]) {
    const candidate = new Date(Date.UTC(y, m - 1, d, -offsetH));
    if (getDublinDateStr(candidate) === dublinDateStr) {
      const candidateH = parseInt(
        new Intl.DateTimeFormat('en-US', {
          timeZone: TIMEZONE, hour: '2-digit', hour12: false,
        }).format(candidate)
      );
      if (candidateH === 0) return candidate;
    }
  }
  return new Date(Date.UTC(y, m - 1, d));
}

function getTimeWindows() {
  const now = new Date();
  const todayStr = getDublinDateStr(now);
  const todayStart = startOfDublinDay(todayStr);

  // Week start — Monday in Dublin
  const dayOfWeek = new Date(todayStr + 'T12:00:00Z').getUTCDay(); // 0=Sun ... 6=Sat
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const mondayDate = new Date(todayStr + 'T12:00:00Z');
  mondayDate.setUTCDate(mondayDate.getUTCDate() - daysFromMonday);
  const mondayStr = mondayDate.toISOString().split('T')[0];
  const thisWeekStart = startOfDublinDay(mondayStr);

  const lastMondayDate = new Date(mondayDate.getTime() - 7 * 86400000);
  const lastMondayStr = lastMondayDate.toISOString().split('T')[0];
  const lastWeekStart = startOfDublinDay(lastMondayStr);

  // Month start
  const monthStr = todayStr.slice(0, 7) + '-01';
  const thisMonthStart = startOfDublinDay(monthStr);

  const [y, mNum] = todayStr.split('-').map(Number);
  const lastMonthY = mNum === 1 ? y - 1 : y;
  const lastMonthM = mNum === 1 ? 12 : mNum - 1;
  const lastMonthStr = `${lastMonthY}-${String(lastMonthM).padStart(2, '0')}-01`;
  const lastMonthStart = startOfDublinDay(lastMonthStr);

  return {
    now,
    todayStart,
    thisWeekStart,
    lastWeekStart,
    lastWeekEnd:   thisWeekStart,
    thisMonthStart,
    lastMonthStart,
    lastMonthEnd:  thisMonthStart,
    thirtyDaysAgo: new Date(now.getTime() - 30 * 24 * 3600 * 1000),
    sevenDaysAgo:  new Date(now.getTime() - 7  * 24 * 3600 * 1000),
    twoHoursAgo:   new Date(now.getTime() - 2  * 3600 * 1000),
  };
}

function calculateConversion(buyers, visitors) {
  if (!visitors) return null;
  if (!buyers) return 0;
  if (buyers > visitors) {
    console.warn(`[dashboard] Suspicious conversion: ${buyers} buyers vs ${visitors} visitors`);
    return 100;
  }
  return Math.round((buyers / visitors) * 1000) / 10;
}

function computeDelta(thisCents, lastCents) {
  if (!lastCents) return { deltaPercent: null, direction: 'neutral' };
  const delta = ((thisCents - lastCents) / lastCents) * 100;
  return {
    deltaPercent: Math.round(delta * 10) / 10,
    direction: thisCents >= lastCents ? 'up' : 'down',
  };
}

// ── Zone 1 ────────────────────────────────────────────────────────────────────

async function getZone1Data({ twoHoursAgo, sevenDaysAgo }) {
  const [ordersToShipCount, lowStockProducts, abandonedCount, failedCount] = await Promise.all([
    Order.countDocuments({ status: 'paid' }),

    Product.find({ status: 'active', totalStock: { $gte: 1, $lte: 4 } })
      .sort({ totalStock: 1 })
      .limit(5)
      .select('_id name totalStock')
      .lean(),

    // Proxy for abandoned carts: 'pending' orders created >2h ago and <7 days ago.
    // Pending orders = Stripe checkout session created but payment not completed.
    // TODO (Phase 2D): filter by customerEmail when cart abandonment email feature ships.
    Order.countDocuments({
      status: 'pending',
      createdAt: { $gte: sevenDaysAgo, $lt: twoHoursAgo },
    }),

    Order.countDocuments({
      status: 'failed',
      createdAt: { $gte: sevenDaysAgo },
    }),
  ]);

  return {
    ordersToShip: {
      count: ordersToShipCount,
      linkTo: '/admin/orders?status=paid',
      label: 'orders waiting to ship',
    },
    lowStock: lowStockProducts.map(p => ({
      productId: p._id,
      productName: p.name,
      stock: p.totalStock,
      linkTo: `/admin/products/${p._id}`,
    })),
    abandonedCarts: {
      count: abandonedCount,
      windowHours: 2,
      linkTo: '/admin/marketing/abandoned-carts',
    },
    failedPayments: {
      count: failedCount,
      linkTo: '/admin/orders?status=failed',
    },
    // unreadMessages: null until Phase 2D contact form ships.
    // Showing "0" would train operators to think the feature is tracking when it isn't.
    unreadMessages: null,
  };
}

// ── Zone 2 ────────────────────────────────────────────────────────────────────

const PAID_STATUSES = ['paid', 'shipped', 'delivered'];

async function sumRevenue(startDate, endDate) {
  const match = {
    status: { $in: PAID_STATUSES },
    createdAt: endDate
      ? { $gte: startDate, $lt: endDate }
      : { $gte: startDate },
  };
  const result = await Order.aggregate([
    { $match: match },
    { $group: {
      _id: null,
      // Order.total is in EUR. Subtract refundedAmount if present.
      revenue: { $sum: { $subtract: ['$total', { $ifNull: ['$refundedAmount', 0] }] } },
      orders:  { $sum: 1 },
    }},
  ]);
  return result[0] || { revenue: 0, orders: 0 };
}

async function getZone2Data(windows) {
  const {
    now, todayStart, thisWeekStart, lastWeekStart, lastWeekEnd,
    thisMonthStart, lastMonthStart, lastMonthEnd,
  } = windows;

  const [todayData, thisWeekData, lastWeekData, thisMonthData, lastMonthData, orders30d] =
    await Promise.all([
      sumRevenue(todayStart),
      sumRevenue(thisWeekStart),
      sumRevenue(lastWeekStart, lastWeekEnd),
      sumRevenue(thisMonthStart),
      sumRevenue(lastMonthStart, lastMonthEnd),
      Order.find({
        status: { $in: PAID_STATUSES },
        createdAt: { $gte: new Date(now.getTime() - 30 * 24 * 3600 * 1000) },
      }).select('total refundedAmount createdAt').lean(),
    ]);

  // Build 30-day chart — one entry per day, oldest first, no gaps
  const chartMap = {};
  for (let i = 29; i >= 0; i--) {
    chartMap[getDublinDateStr(new Date(now.getTime() - i * 86400000))] = 0;
  }
  for (const order of orders30d) {
    const key = getDublinDateStr(new Date(order.createdAt));
    if (key in chartMap) {
      chartMap[key] += Math.round((order.total - (order.refundedAmount || 0)) * 100);
    }
  }

  // Convert EUR totals to integer cents for the response
  const toCents = n => Math.round(n * 100);
  const weekDelta  = computeDelta(toCents(thisWeekData.revenue),  toCents(lastWeekData.revenue));
  const monthDelta = computeDelta(toCents(thisMonthData.revenue), toCents(lastMonthData.revenue));

  return {
    today: {
      revenue: toCents(todayData.revenue),
      orders:  todayData.orders,
      currency: 'EUR',
    },
    thisWeek: {
      revenue: toCents(thisWeekData.revenue),
      orders:  thisWeekData.orders,
      comparison: {
        lastWeekRevenue: toCents(lastWeekData.revenue),
        deltaPercent:    weekDelta.deltaPercent,
        direction:       weekDelta.direction,
      },
    },
    thisMonth: {
      revenue: toCents(thisMonthData.revenue),
      orders:  thisMonthData.orders,
      comparison: {
        lastMonthRevenue: toCents(lastMonthData.revenue),
        deltaPercent:     monthDelta.deltaPercent,
        direction:        monthDelta.direction,
      },
    },
    last30DaysChart: Object.entries(chartMap).map(([date, revenue]) => ({ date, revenue })),
  };
}

// ── Zone 3 ────────────────────────────────────────────────────────────────────

async function getZone3Data({ thirtyDaysAgo }) {
  // Top products by revenue
  const productSales = await Order.aggregate([
    { $match: { status: { $in: PAID_STATUSES }, createdAt: { $gte: thirtyDaysAgo } } },
    { $unwind: '$items' },
    { $match: { 'items.productId': { $exists: true, $ne: null } } },
    { $group: {
      _id: '$items.productId',
      unitsSold: { $sum: '$items.quantity' },
      revenue:   { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
    }},
    { $sort: { revenue: -1 } },
    { $limit: 5 },
  ]);

  // Fetch product details in one query (not N separate queries)
  const productIds = productSales.map(s => s._id).filter(Boolean);
  const products = productIds.length
    ? await Product.find({ _id: { $in: productIds } }).select('name images').lean()
    : [];
  const productMap = Object.fromEntries(products.map(p => [p._id.toString(), p]));

  const topProducts30d = productSales.map(s => {
    const p = productMap[s._id?.toString()];
    const primaryImage = p?.images?.find(img => img.isPrimary) || p?.images?.[0];
    return {
      productId:   s._id,
      productName: p?.name || 'Unknown Product',
      imageUrl:    primaryImage?.url || null,
      unitsSold:   s.unitsSold,
      revenue:     Math.round(s.revenue * 100),
      linkTo:      `/admin/products/${s._id}`,
    };
  });

  // Total paid orders in window (used for showConversion flag)
  const totalOrdersInWindow = await Order.countDocuments({
    status: { $in: PAID_STATUSES },
    createdAt: { $gte: thirtyDaysAgo },
  });
  const showConversion = totalOrdersInWindow > 0;

  // Traffic sources, best-converting product, and geo breakdown from Visit model
  const [sourcesData, bestConvertingData, topCountriesData, topCitiesData, totalVisitorCount] = await Promise.all([
    // Fix: deduplicate by (source, sessionId) first so one session with 4 page-views
    // doesn't count as 4 buyers even if convertedToOrder is set on each visit doc.
    Visit.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      { $group: {
        _id:      { source: '$source', sessionId: '$sessionId' },
        hasOrder: { $max: { $cond: [{ $ne: ['$convertedToOrder', null] }, 1, 0] } },
      }},
      { $group: {
        _id:      '$_id.source',
        visitors: { $sum: 1 },
        buyers:   { $sum: '$hasOrder' },
      }},
      { $sort: { visitors: -1 } },
      { $limit: 5 },
    ]),

    Visit.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo }, productId: { $exists: true, $ne: null } } },
      { $group: {
        _id:    '$productId',
        visits: { $sum: 1 },
        orders: { $sum: { $cond: [{ $ne: ['$convertedToOrder', null] }, 1, 0] } },
      }},
      // 50-visit threshold: below this, conversion rates are noise not signal
      { $match: { visits: { $gte: 50 }, orders: { $gte: 1 } } },
      { $addFields: {
        conversionRate: { $multiply: [{ $divide: ['$orders', '$visits'] }, 100] },
      }},
      { $sort: { conversionRate: -1 } },
      { $limit: 1 },
    ]),

    Visit.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo }, country: { $exists: true, $ne: null } } },
      { $group: { _id: { country: '$country', countryCode: '$countryCode' }, visitors: { $addToSet: '$sessionId' } } },
      { $project: { country: '$_id.country', countryCode: '$_id.countryCode', visitors: { $size: '$visitors' } } },
      { $sort: { visitors: -1 } },
      { $limit: 5 },
    ]),

    Visit.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo }, city: { $exists: true, $ne: null } } },
      { $group: { _id: { city: '$city', country: '$country' }, visitors: { $addToSet: '$sessionId' } } },
      { $project: { city: '$_id.city', country: '$_id.country', visitors: { $size: '$visitors' } } },
      { $sort: { visitors: -1 } },
      { $limit: 5 },
    ]),

    // Total unique sessions across all sources (denominator for % of traffic)
    Visit.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: '$sessionId' } },
      { $count: 'total' },
    ]),
  ]);

  const totalVisitors = totalVisitorCount[0]?.total || 0;

  const topTrafficSources30d = sourcesData.map(s => ({
    source:            s._id || 'direct',
    displayLabel:      displayLabel(s._id || 'direct'),
    visitors:          s.visitors,
    buyers:            s.buyers,
    conversionPercent: calculateConversion(s.buyers, s.visitors),
    percentOfTraffic:  totalVisitors > 0
      ? Math.round((s.visitors / totalVisitors) * 1000) / 10
      : null,
  }));

  const topCountries30d = topCountriesData.map(c => ({
    country:          c.country,
    countryCode:      c.countryCode || null,
    visitors:         c.visitors,
    percentOfTraffic: totalVisitors > 0
      ? Math.round((c.visitors / totalVisitors) * 1000) / 10
      : null,
  }));

  const topCities30d = topCitiesData.map(c => ({
    city:             c.city,
    country:          c.country || null,
    visitors:         c.visitors,
    percentOfTraffic: totalVisitors > 0
      ? Math.round((c.visitors / totalVisitors) * 1000) / 10
      : null,
  }));

  let bestConvertingProduct30d = null;
  if (bestConvertingData.length > 0) {
    const best = bestConvertingData[0];
    const p = await Product.findById(best._id).select('name images').lean();
    if (p) {
      const primaryImage = p.images?.find(img => img.isPrimary) || p.images?.[0];
      bestConvertingProduct30d = {
        productId:         best._id,
        productName:       p.name,
        imageUrl:          primaryImage?.url || null,
        conversionPercent: Math.round(best.conversionRate * 100) / 100,
        linkTo:            `/admin/products/${best._id}`,
      };
    }
  }

  return { topProducts30d, topTrafficSources30d, topCountries30d, topCities30d, bestConvertingProduct30d, showConversion };
}

// ── Route ─────────────────────────────────────────────────────────────────────

let dashCache = null;
let dashCacheAt = 0;
const CACHE_TTL = 60 * 1000;

router.get('/', requireAuth, async function(req, res) {
  const now = Date.now();
  const force = req.query.force === 'true';

  if (!force && dashCache && (now - dashCacheAt) < CACHE_TTL) {
    return res.json({ ...dashCache, cached: true });
  }

  try {
    const windows = getTimeWindows();
    const [zone1, zone2, zone3] = await Promise.all([
      getZone1Data(windows),
      getZone2Data(windows),
      getZone3Data(windows),
    ]);

    const payload = {
      generatedAt:          new Date().toISOString(),
      cached:               false,
      zone1_actionItems:    zone1,
      zone2_metrics:        zone2,
      zone3_whatIsWorking:  zone3,
    };

    dashCache    = payload;
    dashCacheAt  = now;
    res.json(payload);
  } catch (err) {
    console.error('[dashboard] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
