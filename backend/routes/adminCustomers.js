const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { requireAuth } = require('../middleware/auth');
const { emailBlastLimit } = require('../middleware/rateLimiters');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const PromoCode = require('../models/PromoCode');
const Segment = require('../models/Segment');
const { recomputeAll, ensureSegmentDocs } = require('../services/segments');
const { maskEmail } = require('../utils/maskEmail');

router.use(requireAuth);

// ── GET /api/admin/customers — paginated list ─────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip = (page - 1) * limit;

    const filter = { gdprDeletedAt: null };
    if (req.query.segment) filter.segments = req.query.segment;
    if (req.query.search) {
      const re = new RegExp(req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ email: re }, { firstName: re }, { lastName: re }];
    }
    if (req.query.consent === 'yes') filter.marketingConsent = true;

    const [customers, total] = await Promise.all([
      Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Customer.countDocuments(filter),
    ]);

    // Segment tiles for the sidebar
    const segments = await Segment.find().sort({ slug: 1 }).lean();

    res.json({ customers, total, page, pages: Math.ceil(total / limit), segments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/admin/customers/segments/recompute — trigger full recompute ──────
router.post('/segments/recompute', async (req, res) => {
  try {
    await ensureSegmentDocs();
    const result = await recomputeAll();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/admin/customers/winback — email the at-risk segment a gentle ────
// reminder that the existing 10% offer (SILK10) is still available. Founder
// choice: NO new codes minted — just a reminder. We skip anyone who has
// already redeemed SILK10 (so the offer in the email is actually usable).
// Mounted before /:id so the static path isn't shadowed.
router.post('/winback', emailBlastLimit, async (req, res) => {
  try {
    const { sendWinbackReminder } = require('../services/email');
    if (!process.env.RESEND_API_KEY) return res.status(503).json({ error: 'Email not configured' });

    const customers = await Customer.find({
      segments: 'at-risk',
      gdprDeletedAt: null,
      marketingConsent: true,
      email: { $exists: true, $nin: [null, ''] },
    }).select('email firstName').limit(300).lean();

    // Emails that already redeemed SILK10 — exclude them (code is single-use
    // per customer, so reminding them would be hollow).
    const usedSilk10 = new Set(
      (await Order.find({ discountCode: { $regex: '^silk10$', $options: 'i' } }).select('customerEmail').lean())
        .map(o => (o.customerEmail || '').toLowerCase())
    );

    let sent = 0, skipped = 0;
    for (const c of customers) {
      if (usedSilk10.has((c.email || '').toLowerCase())) { skipped++; continue; }
      try {
        await sendWinbackReminder({ email: c.email, firstName: c.firstName });
        sent++;
      } catch (err) {
        console.error('[winback] send failed:', maskEmail(c.email), err.message);
        skipped++;
      }
    }

    res.json({ sent, skipped, eligible: customers.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/admin/customers/:id — full detail ────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id).lean();
    if (!customer) return res.status(404).json({ error: 'Not found' });

    const orders = await Order.find({ customerEmail: customer.email })
      .sort({ createdAt: -1 }).lean();

    const totalSpend = orders
      .filter(o => ['paid', 'processing', 'shipped', 'delivered'].includes(o.status))
      .reduce((s, o) => s + (o.total || 0), 0);

    res.json({ customer, orders, totalSpend });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/admin/customers — manual customer creation ──────────────────────
router.post('/', async (req, res) => {
  try {
    const { email, firstName, lastName, phone, marketingConsent, tags, customerType } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const existing = await Customer.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: 'Customer already exists', customerId: existing._id });
    const customer = await Customer.create({
      email: email.toLowerCase(),
      firstName: firstName || '',
      lastName: lastName || '',
      phone: phone || '',
      marketingConsent: !!marketingConsent,
      tags: tags || [],
      customerType: customerType || 'retail',
      emailVerified: true,
    });
    res.status(201).json(customer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/admin/customers/:id — update profile / tags / notes ──────────────
router.put('/:id', async (req, res) => {
  try {
    const allowed = ['firstName', 'lastName', 'phone', 'tags', 'customerType', 'internalRating', 'marketingConsent', 'consent'];
    const update = {};
    for (const k of allowed) {
      if (k in req.body) update[k] = req.body[k];
    }
    const customer = await Customer.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
    if (!customer) return res.status(404).json({ error: 'Not found' });
    res.json(customer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/admin/customers/:id/notes — add internal note ──────────────────
router.post('/:id/notes', async (req, res) => {
  try {
    const { body } = req.body;
    if (!body) return res.status(400).json({ error: 'Note body required' });
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { $push: { notes: { body } } },
      { new: true },
    );
    if (!customer) return res.status(404).json({ error: 'Not found' });
    res.json(customer.notes[customer.notes.length - 1]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/admin/customers/:id/notes/:noteId ────────────────────────────
router.delete('/:id/notes/:noteId', async (req, res) => {
  try {
    await Customer.findByIdAndUpdate(req.params.id, { $pull: { notes: { _id: req.params.noteId } } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/admin/customers/:id/promo-code — generate personal promo code ──
router.post('/:id/promo-code', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Not found' });

    const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    const firstName = (customer.firstName || 'CUSTOMER').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8);
    const code = `${firstName}-${suffix}`;

    const { type = 'percentage', value = 10, minOrderValue = 0, validDays = null } = req.body;
    const validUntil = validDays ? new Date(Date.now() + validDays * 86400000) : null;

    const promo = await PromoCode.create({
      code,
      type,
      value,
      minOrderValue,
      maxUses: 1,
      maxUsesPerCustomer: 1,
      validUntil,
      status: 'active',
      active: true,
      redemptionType: 'single_use_per_customer',
      source: 'customer_personal',
      targetCustomerId: customer._id,
      description: `Personal code for ${customer.firstName || customer.email}`,
    });

    res.status(201).json(promo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/admin/customers/:id/gdpr-export — download PII as JSON ──────────
router.get('/:id/gdpr-export', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id).lean();
    if (!customer) return res.status(404).json({ error: 'Not found' });
    const orders = await Order.find({ customerEmail: customer.email }).lean();

    const payload = {
      exportedAt: new Date().toISOString(),
      customer: {
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        defaultShippingAddress: customer.defaultShippingAddress,
        marketingConsent: customer.marketingConsent,
        createdAt: customer.createdAt,
        lastLogin: customer.lastLogin,
      },
      orders: orders.map(o => ({
        orderNumber: o.orderNumber,
        total: o.total,
        status: o.status,
        createdAt: o.createdAt,
        items: o.items,
      })),
    };

    res.setHeader('Content-Disposition', `attachment; filename="gdpr-export-${customer._id}.json"`);
    res.json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/admin/customers/:id/gdpr — anonymise PII, preserve order history ─
router.delete('/:id/gdpr', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Not found' });
    if (customer.gdprDeletedAt) return res.status(409).json({ error: 'Already anonymised' });

    const anonEmail = `deleted-${customer._id}@anonymised.silkilinen.com`;

    await customer.updateOne({
      $set: {
        email: anonEmail,
        firstName: '[Deleted]',
        lastName: '',
        phone: '',
        defaultShippingAddress: null,
        passwordHash: null,
        googleId: null,
        wishlist: [],
        tags: [],
        notes: [],
        emailLog: [],
        gdprDeletedAt: new Date(),
      },
    });

    res.json({ success: true, anonEmail });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/admin/customers/export/csv — bulk CSV for Meta Custom Audiences ──
router.get('/export/csv', async (req, res) => {
  try {
    const filter = { gdprDeletedAt: null, marketingConsent: true };
    if (req.query.segment) filter.segments = req.query.segment;
    const customers = await Customer.find(filter).lean();

    const rows = ['email,firstName,lastName,phone'];
    for (const c of customers) {
      rows.push([c.email, c.firstName, c.lastName, c.phone].map(v => `"${(v || '').replace(/"/g, '""')}"`).join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="customers.csv"');
    res.send(rows.join('\n'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
