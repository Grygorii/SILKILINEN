const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Customer = require('../models/Customer');

router.use(requireAuth);

// ── GET /api/admin/search?q= — global command-palette search ──────────────────
router.get('/', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json({ results: [] });

    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const [products, orders, customers] = await Promise.all([
      Product.find({ name: re }).select('name status price images').limit(5).lean(),
      Order.find({ $or: [{ orderNumber: re }, { customerName: re }, { customerEmail: re }] })
        .select('orderNumber customerName customerEmail total status')
        .limit(5).lean(),
      Customer.find({ $or: [{ firstName: re }, { lastName: re }, { email: re }] })
        .select('firstName lastName email')
        .limit(5).lean(),
    ]);

    const results = [
      ...products.map(p => ({
        type: 'product',
        id: String(p._id),
        label: p.name,
        sub: `${p.status} · €${p.price}`,
        href: `/admin/products/${p._id}`,
      })),
      ...orders.map(o => ({
        type: 'order',
        id: String(o._id),
        label: o.orderNumber || String(o._id).slice(-6),
        sub: `${o.customerName || o.customerEmail || ''} · €${o.total ?? 0} · ${o.status}`,
        href: `/admin/orders/${o._id}`,
      })),
      ...customers.map(c => {
        const name = [c.firstName, c.lastName].filter(Boolean).join(' ');
        return {
          type: 'customer',
          id: String(c._id),
          label: name || c.email,
          sub: c.email,
          href: `/admin/customers/${c._id}`,
        };
      }),
    ].slice(0, 15);

    res.json({ results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
