'use strict';

// "Ask your store" — AI business analyst over the shop's real data.
//
// Safety model: the AI NEVER writes queries. It picks from a fixed catalog
// of read-only aggregation tools (below), we run them, and it writes a plain-
// English answer from the results. Two calls to the model per question:
//   1. plan  — pick up to 3 tools + arguments (strict JSON)
//   2. answer — compose the reply from the tool results
// Numbers are computed with the same conventions as the dashboard
// (PAID_STATUSES) so the analyst never disagrees with the panels.

const Order = require('../models/Order');
const Visit = require('../models/Visit');
const Product = require('../models/Product');
const Customer = require('../models/Customer');

const client = require('./aiClient'); // shared DeepSeek client
const MODEL = process.env.DEEPSEEK_MODEL_ANALYST || 'deepseek-chat';

const PAID_STATUSES = ['paid', 'shipped', 'delivered'];

function since(days) {
  return new Date(Date.now() - days * 86400000);
}
function clampDays(d, def = 30) {
  const n = Math.floor(Number(d));
  return Number.isFinite(n) ? Math.min(365, Math.max(1, n)) : def;
}

// ── Tool catalog ──────────────────────────────────────────────────────────────

const TOOLS = {
  sales_summary: {
    description: 'Orders, revenue, average order value for the last N days, with the previous period for comparison. Args: {days}',
    run: async ({ days }) => {
      const d = clampDays(days);
      const [cur, prev] = await Promise.all([
        Order.aggregate([
          { $match: { status: { $in: PAID_STATUSES }, createdAt: { $gte: since(d) } } },
          { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: '$total' } } },
        ]),
        Order.aggregate([
          { $match: { status: { $in: PAID_STATUSES }, createdAt: { $gte: since(d * 2), $lt: since(d) } } },
          { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: '$total' } } },
        ]),
      ]);
      const c = cur[0] || { orders: 0, revenue: 0 };
      const p = prev[0] || { orders: 0, revenue: 0 };
      return {
        periodDays: d,
        orders: c.orders,
        revenueEUR: Math.round(c.revenue * 100) / 100,
        avgOrderValueEUR: c.orders ? Math.round((c.revenue / c.orders) * 100) / 100 : 0,
        previousPeriod: { orders: p.orders, revenueEUR: Math.round(p.revenue * 100) / 100 },
      };
    },
  },

  top_products: {
    description: 'Best-selling products in the last N days by revenue and units. Args: {days}',
    run: async ({ days }) => {
      const d = clampDays(days);
      const rows = await Order.aggregate([
        { $match: { status: { $in: PAID_STATUSES }, createdAt: { $gte: since(d) } } },
        { $unwind: '$items' },
        { $group: {
          _id: '$items.name',
          units: { $sum: '$items.quantity' },
          revenueEUR: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        } },
        { $sort: { revenueEUR: -1 } },
        { $limit: 10 },
      ]);
      return { periodDays: d, products: rows.map(r => ({ name: r._id, units: r.units, revenueEUR: Math.round(r.revenueEUR * 100) / 100 })) };
    },
  },

  sales_by_country: {
    description: 'Orders and revenue grouped by shipping country, last N days. Args: {days}',
    run: async ({ days }) => {
      const d = clampDays(days);
      const rows = await Order.aggregate([
        { $match: { status: { $in: PAID_STATUSES }, createdAt: { $gte: since(d) } } },
        { $group: { _id: '$shippingAddress.country', orders: { $sum: 1 }, revenueEUR: { $sum: '$total' } } },
        { $sort: { revenueEUR: -1 } },
        { $limit: 15 },
      ]);
      return { periodDays: d, countries: rows.map(r => ({ country: r._id || 'unknown', orders: r.orders, revenueEUR: Math.round(r.revenueEUR * 100) / 100 })) };
    },
  },

  traffic_summary: {
    description: 'Site visits: unique sessions, traffic sources, top pages, top countries/cities, last N days. Args: {days}',
    run: async ({ days }) => {
      const d = clampDays(days);
      const match = { createdAt: { $gte: since(d) } };
      const [sessions, sources, pages, cities] = await Promise.all([
        Visit.aggregate([{ $match: match }, { $group: { _id: '$sessionId' } }, { $count: 'n' }]),
        Visit.aggregate([{ $match: match }, { $group: { _id: { sid: '$sessionId', src: '$source' } } }, { $group: { _id: '$_id.src', sessions: { $sum: 1 } } }, { $sort: { sessions: -1 } }]),
        Visit.aggregate([{ $match: match }, { $group: { _id: '$page', views: { $sum: 1 } } }, { $sort: { views: -1 } }, { $limit: 8 }]),
        Visit.aggregate([{ $match: { ...match, city: { $ne: null } } }, { $group: { _id: { city: '$city', country: '$country' }, visits: { $sum: 1 } } }, { $sort: { visits: -1 } }, { $limit: 8 }]),
      ]);
      return {
        periodDays: d,
        uniqueSessions: sessions[0]?.n || 0,
        bySource: sources.map(s => ({ source: s._id || 'direct', sessions: s.sessions })),
        topPages: pages.map(p => ({ page: p._id, views: p.views })),
        topCities: cities.map(c => ({ city: c._id.city, country: c._id.country, visits: c.visits })),
      };
    },
  },

  conversion: {
    description: 'Conversion rate: unique visitor sessions vs paid orders, last N days. Args: {days}',
    run: async ({ days }) => {
      const d = clampDays(days);
      const [sessions, orders] = await Promise.all([
        Visit.aggregate([{ $match: { createdAt: { $gte: since(d) } } }, { $group: { _id: '$sessionId' } }, { $count: 'n' }]),
        Order.countDocuments({ status: { $in: PAID_STATUSES }, createdAt: { $gte: since(d) } }),
      ]);
      const s = sessions[0]?.n || 0;
      return { periodDays: d, uniqueSessions: s, paidOrders: orders, conversionRatePct: s ? Math.round((orders / s) * 10000) / 100 : null };
    },
  },

  stock_report: {
    description: 'Inventory: out-of-stock and low-stock variants (size/colour level). No args.',
    run: async () => {
      const products = await Product.find({ status: { $in: ['active', 'sold_out'] } }).select('name variants').lean();
      const low = [], out = [];
      for (const p of products) {
        for (const v of p.variants || []) {
          const threshold = typeof v.lowStockThreshold === 'number' ? v.lowStockThreshold : 3;
          const level = v.stockLevel || 0;
          const row = { product: p.name, variant: [v.colour, v.size].filter(Boolean).join(' ') || v.sku || '', stock: level };
          if (level === 0) out.push(row);
          else if (level <= threshold) low.push(row);
        }
      }
      return { outOfStock: out.slice(0, 20), lowStock: low.slice(0, 20), outOfStockCount: out.length, lowStockCount: low.length };
    },
  },

  finance_summary: {
    description: 'Profitability for the last N days: revenue, cost of goods, Stripe fees, shipping spend, gross profit. Flags how many orders are missing cost data. Args: {days}',
    run: async ({ days }) => {
      const d = clampDays(days);
      const rows = await Order.aggregate([
        { $match: { status: { $in: PAID_STATUSES }, createdAt: { $gte: since(d) } } },
        { $group: {
          _id: null,
          orders: { $sum: 1 },
          revenueEUR: { $sum: '$total' },
          cogsEUR: { $sum: { $ifNull: ['$costs.cogs', 0] } },
          stripeFeesEUR: { $sum: { $ifNull: ['$costs.stripeFee', 0] } },
          shippingSpendEUR: { $sum: { $ifNull: ['$costs.shippingCost', 0] } },
          missingCogs: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$costs.cogs', null] }, null] }, 1, 0] } },
        } },
      ]);
      const r = rows[0] || { orders: 0, revenueEUR: 0, cogsEUR: 0, stripeFeesEUR: 0, shippingSpendEUR: 0, missingCogs: 0 };
      const round = n => Math.round(n * 100) / 100;
      return {
        periodDays: d,
        orders: r.orders,
        revenueEUR: round(r.revenueEUR),
        cogsEUR: round(r.cogsEUR),
        stripeFeesEUR: round(r.stripeFeesEUR),
        shippingSpendEUR: round(r.shippingSpendEUR),
        grossProfitEUR: round(r.revenueEUR - r.cogsEUR - r.stripeFeesEUR - r.shippingSpendEUR),
        ordersMissingCostData: r.missingCogs,
        note: r.missingCogs > 0 ? 'Profit is overstated — some orders have no cost data recorded.' : undefined,
      };
    },
  },

  customers_summary: {
    description: 'Customer base: totals, segment counts, top customers by lifetime spend. No args.',
    run: async () => {
      const [total, segments, top] = await Promise.all([
        Customer.estimatedDocumentCount(),
        Customer.aggregate([{ $unwind: '$segments' }, { $group: { _id: '$segments', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
        Customer.find().sort({ totalSpent: -1 }).limit(5).select('name email totalSpent orderCount').lean(),
      ]);
      return {
        totalCustomers: total,
        segments: segments.map(s => ({ segment: s._id, count: s.count })),
        topBySpend: top.map(c => ({ name: c.name || c.email, totalSpentEUR: c.totalSpent || 0, orders: c.orderCount || 0 })),
      };
    },
  },

  promo_performance: {
    description: 'Discount-code usage in paid orders, last N days. Args: {days}',
    run: async ({ days }) => {
      const d = clampDays(days);
      const rows = await Order.aggregate([
        { $match: { status: { $in: PAID_STATUSES }, createdAt: { $gte: since(d) }, discountCode: { $nin: [null, ''] } } },
        { $group: { _id: '$discountCode', uses: { $sum: 1 }, revenueEUR: { $sum: '$total' }, discountGivenEUR: { $sum: { $ifNull: ['$discountAmount', 0] } } } },
        { $sort: { uses: -1 } },
      ]);
      return { periodDays: d, codes: rows.map(r => ({ code: r._id, uses: r.uses, revenueEUR: Math.round(r.revenueEUR * 100) / 100, discountGivenEUR: Math.round(r.discountGivenEUR * 100) / 100 })) };
    },
  },

  recent_orders: {
    description: 'The most recent orders (any status) with totals and destinations. Args: {limit} (max 20)',
    run: async ({ limit }) => {
      const n = Math.min(20, Math.max(1, Math.floor(Number(limit)) || 10));
      const orders = await Order.find().sort({ createdAt: -1 }).limit(n)
        .select('orderNumber total status shippingAddress.country createdAt items').lean();
      return {
        orders: orders.map(o => ({
          number: o.orderNumber || String(o._id).slice(-6),
          totalEUR: o.total,
          status: o.status,
          country: o.shippingAddress?.country || 'unknown',
          items: (o.items || []).reduce((s, i) => s + (i.quantity || 0), 0),
          date: o.createdAt,
        })),
      };
    },
  },
};

// ── Orchestration ─────────────────────────────────────────────────────────────

function toolCatalogText() {
  return Object.entries(TOOLS).map(([name, t]) => `- ${name}: ${t.description}`).join('\n');
}

const PLAN_PROMPT = `You are the data analyst for SILKILINEN, a luxury silk & linen e-commerce store (currency EUR). Given the founder's question, choose which data tools to run (1-3 of them) from this catalog:

${toolCatalogText()}

Reply with STRICT JSON only: {"tools":[{"name":"<tool>","args":{...}}]}
Rules: only tools from the catalog; default days=30 when the question gives no period ("today"=1, "this week"=7, "this month"=30, "this year"=365); if the question is not answerable with these tools, reply {"tools":[]}.`;

const ANSWER_PROMPT = `You are the business analyst for SILKILINEN, a small luxury silk & linen store run by its founder. Answer the founder's question from the tool results below. Rules:
- Use ONLY the numbers in the results — never invent figures. All money is EUR.
- Lead with the direct answer, then 1-3 short supporting points. Plain text, no markdown tables.
- Mention caveats the data carries (e.g. orders missing cost data, small sample sizes).
- If the results can't answer the question, say so plainly and suggest where in the admin to look.
- Friendly, plain English, concise — the founder is busy.`;

async function ask(question, history = []) {
  if (!process.env.DEEPSEEK_API_KEY) {
    return { answer: 'AI is not configured (DEEPSEEK_API_KEY missing in the backend environment).', toolsUsed: [] };
  }
  const q = String(question || '').slice(0, 500);
  const past = (Array.isArray(history) ? history : []).slice(-6).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 1000),
  }));

  // Step 1: plan
  const planRes = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: PLAN_PROMPT },
      ...past,
      { role: 'user', content: q },
    ],
    temperature: 0,
    max_tokens: 300,
    response_format: { type: 'json_object' },
  });
  let plan = { tools: [] };
  try { plan = JSON.parse(planRes.choices[0]?.message?.content || '{}'); } catch { /* fall through */ }

  // Execute (allowlisted only, max 3)
  const requested = (Array.isArray(plan.tools) ? plan.tools : []).slice(0, 3);
  const results = {};
  const toolsUsed = [];
  for (const t of requested) {
    const tool = TOOLS[t.name];
    if (!tool) continue;
    try {
      results[t.name] = await tool.run(t.args || {});
      toolsUsed.push(t.name);
    } catch (err) {
      results[t.name] = { error: 'tool failed' };
      console.error(`[analyst] tool ${t.name} failed:`, err.message);
    }
  }

  // Step 2: answer
  const answerRes = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: ANSWER_PROMPT },
      ...past,
      { role: 'user', content: `Question: ${q}\n\nTool results:\n${JSON.stringify(results, null, 2)}` },
    ],
    temperature: 0.3,
    max_tokens: 600,
  });

  const answer = answerRes.choices[0]?.message?.content?.trim()
    || 'I could not produce an answer — please try rephrasing the question.';
  return { answer, toolsUsed };
}

module.exports = { ask };
