const express = require('express');
const { csvCell, csvRow } = require('../utils/csv');
const router = express.Router();
const { normalizeEmail, escapeRegex, ordersForCustomer } = require('../utils/customerIdentity');
const { customerOrderStats } = require('../utils/customerOrderStats');
const { ADMIN_CUSTOMER_FIELDS, adminCustomerView } = require('../utils/customerViews');
const { validateProfile, requireEmail } = require('../utils/customerValidation');
const { reconcileCustomerOrders, pendingFilter } = require('../services/customerOrders');
const { eraseCustomer } = require('../services/customerErasure');
const crypto = require('crypto');
const { requireAuth } = require('../middleware/auth');
const { emailBlastLimit } = require('../middleware/rateLimiters');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
// Erasure must reach every store that holds the address, not only Customer.
const Cart = require('../models/Cart');
const Newsletter = require('../models/Newsletter');
const PromoCode = require('../models/PromoCode');
const Segment = require('../models/Segment');
const WishlistInterest = require('../models/WishlistInterest');
const { recomputeAll, ensureSegmentDocs } = require('../services/segments');
const { maskEmail } = require('../utils/maskEmail');

router.use(requireAuth);
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.param('id', (req, res, next, id) => {
  if (!/^[0-9a-fA-F]{24}$/.test(id)) return res.status(400).json({ error: 'Invalid customer ID' });
  next();
});

// ── GET /api/admin/customers — paginated list ─────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const filter = { gdprDeletedAt: null };
    if (typeof req.query.segment === 'string' && req.query.segment.length <= 80) filter.segments = req.query.segment;
    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      const re = new RegExp(escapeRegex(req.query.search.trim().slice(0, 150)), 'i');
      filter.$or = [{ email: re }, { firstName: re }, { lastName: re }];
    }
    if (req.query.consent === 'yes') filter.marketingConsent = true;

    const [customers, total] = await Promise.all([
      Customer.find(filter).select(ADMIN_CUSTOMER_FIELDS).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Customer.countDocuments(filter),
    ]);

    // Segment tiles for the sidebar
    const segments = await Segment.find().sort({ slug: 1 }).lean();

    const [pending, unresolved] = await Promise.all([
      Order.countDocuments(pendingFilter),
      Order.countDocuments({ customerSyncStatus: { $in: ['missing_email', 'invalid_customer_link'] } }),
    ]);
    res.json({ customers, total, page, pages: Math.ceil(total / limit), segments, reconciliation: { pending, unresolved } });
  } catch (err) {
    console.error(err);
    res.status(err.status || (err.name === 'ValidationError' ? 400 : err.code === 11000 ? 409 : 500)).json({ error: err.expose ? err.message : err.code === 11000 ? 'Customer already exists' : err.name === 'ValidationError' ? 'Invalid customer data' : 'Internal server error' });
  }
});

// ── GET /api/admin/customers/segments/recompute — trigger full recompute ──────
router.post('/segments/recompute', async (req, res) => {
  try {
    await ensureSegmentDocs();
    const result = await reconcileCustomerOrders({ limit: 100 });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(err.status || (err.name === 'ValidationError' ? 400 : err.code === 11000 ? 409 : 500)).json({ error: err.expose ? err.message : err.code === 11000 ? 'Customer already exists' : err.name === 'ValidationError' ? 'Invalid customer data' : 'Internal server error' });
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
    }).select('_id email firstName').limit(300).lean();

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
        await sendWinbackReminder({ email: c.email, firstName: c.firstName, customerId: c._id });
        sent++;
      } catch (err) {
        console.error('[winback] send failed:', maskEmail(c.email), err.message);
        skipped++;
      }
    }

    res.json({ sent, skipped, eligible: customers.length });
  } catch (err) {
    console.error(err);
    res.status(err.status || (err.name === 'ValidationError' ? 400 : err.code === 11000 ? 409 : 500)).json({ error: err.expose ? err.message : err.code === 11000 ? 'Customer already exists' : err.name === 'ValidationError' ? 'Invalid customer data' : 'Internal server error' });
  }
});

// ── GET /api/admin/customers/:id — full detail ────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, gdprDeletedAt: null }).select(ADMIN_CUSTOMER_FIELDS).lean();
    if (!customer) return res.status(404).json({ error: 'Not found' });

    const orders = await Order.find(ordersForCustomer(customer))
      .sort({ createdAt: -1 }).lean();

    const stats = customerOrderStats(orders);
    res.json({ customer: { ...customer, ...stats }, orders, totalSpend: stats.totalSpend });
  } catch (err) {
    console.error(err);
    res.status(err.status || (err.name === 'ValidationError' ? 400 : err.code === 11000 ? 409 : 500)).json({ error: err.expose ? err.message : err.code === 11000 ? 'Customer already exists' : err.name === 'ValidationError' ? 'Invalid customer data' : 'Internal server error' });
  }
});

// ── POST /api/admin/customers — manual customer creation ──────────────────────
router.post('/', async (req, res) => {
  try {
    const email = requireEmail(req.body.email);
    const fields = validateProfile(req.body, true);
    const existing = await Customer.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Customer already exists', customerId: existing._id });
    const customer = await Customer.create({ ...fields, email, profileSource: 'manual', emailVerified: false });
    res.status(201).json(adminCustomerView(customer));
  } catch (err) {
    console.error(err);
    res.status(err.status || (err.name === 'ValidationError' ? 400 : err.code === 11000 ? 409 : 500)).json({ error: err.expose ? err.message : err.code === 11000 ? 'Customer already exists' : err.name === 'ValidationError' ? 'Invalid customer data' : 'Internal server error' });
  }
});

// ── PUT /api/admin/customers/:id — update profile / tags / notes ──────────────
router.put('/:id', async (req, res) => {
  try {
    const update = validateProfile(req.body, true);
    const customer = await Customer.findOneAndUpdate({ _id: req.params.id, gdprDeletedAt: null }, { $set: update }, { returnDocument: 'after', runValidators: true }).select(ADMIN_CUSTOMER_FIELDS);
    if (!customer) return res.status(404).json({ error: 'Not found' });
    if (update.marketingConsent === false) {
      await Newsletter.updateMany(
        { $or: [{ customerId: customer._id }, { email: customer.email }] },
        { $set: { isUnsubscribed: true } },
      );
    }
    res.json(adminCustomerView(customer));
  } catch (err) {
    console.error(err);
    res.status(err.status || (err.name === 'ValidationError' ? 400 : err.code === 11000 ? 409 : 500)).json({ error: err.expose ? err.message : err.code === 11000 ? 'Customer already exists' : err.name === 'ValidationError' ? 'Invalid customer data' : 'Internal server error' });
  }
});

// ── POST /api/admin/customers/:id/notes — add internal note ──────────────────
router.post('/:id/notes', async (req, res) => {
  try {
    const { body } = req.body;
    if (typeof body !== 'string' || !body.trim() || body.length > 5000) return res.status(400).json({ error: 'Note must contain 1–5000 characters' });
    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, gdprDeletedAt: null },
      { $push: { notes: { body: body.trim() } } },
      { returnDocument: 'after', runValidators: true },
    );
    if (!customer) return res.status(404).json({ error: 'Not found' });
    res.json(customer.notes[customer.notes.length - 1]);
  } catch (err) {
    console.error(err);
    res.status(err.status || (err.name === 'ValidationError' ? 400 : err.code === 11000 ? 409 : 500)).json({ error: err.expose ? err.message : err.code === 11000 ? 'Customer already exists' : err.name === 'ValidationError' ? 'Invalid customer data' : 'Internal server error' });
  }
});

// ── DELETE /api/admin/customers/:id/notes/:noteId ────────────────────────────
router.delete('/:id/notes/:noteId', async (req, res) => {
  try {
    await Customer.findByIdAndUpdate(req.params.id, { $pull: { notes: { _id: req.params.noteId } } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(err.status || (err.name === 'ValidationError' ? 400 : err.code === 11000 ? 409 : 500)).json({ error: err.expose ? err.message : err.code === 11000 ? 'Customer already exists' : err.name === 'ValidationError' ? 'Invalid customer data' : 'Internal server error' });
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
    res.status(err.status || (err.name === 'ValidationError' ? 400 : err.code === 11000 ? 409 : 500)).json({ error: err.expose ? err.message : err.code === 11000 ? 'Customer already exists' : err.name === 'ValidationError' ? 'Invalid customer data' : 'Internal server error' });
  }
});

// ── GET /api/admin/customers/:id/gdpr-export — download PII as JSON ──────────
router.get('/:id/gdpr-export', async (req, res) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, gdprDeletedAt: null }).select(ADMIN_CUSTOMER_FIELDS).lean();
    if (!customer) return res.status(404).json({ error: 'Not found' });
    const [orders, wishlistInterests] = await Promise.all([
      Order.find(ordersForCustomer(customer)).lean(),
      WishlistInterest.find({ customerId: customer._id }).select('productId savedAt removedAt completedAt reminderAttemptedAt reminderSentAt').lean(),
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      customer: {
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        defaultShippingAddress: customer.defaultShippingAddress,
        marketingConsent: customer.marketingConsent,
        lastWishlistReminderAttemptedAt: customer.lastWishlistReminderAttemptedAt,
        createdAt: customer.createdAt,
        lastLogin: customer.lastLogin,
        wishlist: customer.wishlist || [],
      },
      wishlistReminderHistory: wishlistInterests,
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
    res.status(err.status || (err.name === 'ValidationError' ? 400 : err.code === 11000 ? 409 : 500)).json({ error: err.expose ? err.message : err.code === 11000 ? 'Customer already exists' : err.name === 'ValidationError' ? 'Invalid customer data' : 'Internal server error' });
  }
});

// ── DELETE /api/admin/customers/:id/gdpr — anonymise PII, preserve order history ─
router.delete('/:id/gdpr', async (req, res) => {
  try { res.json(await eraseCustomer(req.params.id)); }
  catch (err) { res.status(err.status || 500).json({ error: err.status ? err.message : 'Erasure failed; no partial erasure was committed' }); }
});

// ── GET /api/admin/customers/export/csv — bulk CSV for Meta Custom Audiences ──
router.get('/export/csv', async (req, res) => {
  try {
    const filter = { gdprDeletedAt: null, marketingConsent: true };
    if (typeof req.query.segment === 'string' && req.query.segment.length <= 80) filter.segments = req.query.segment;
    const customers = await Customer.find(filter).lean();

    const rows = ['email,firstName,lastName,phone'];
    for (const c of customers) {
      rows.push(csvRow([c.email, c.firstName, c.lastName, c.phone]));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="customers.csv"');
    res.send(rows.join('\n'));
  } catch (err) {
    console.error(err);
    res.status(err.status || (err.name === 'ValidationError' ? 400 : err.code === 11000 ? 409 : 500)).json({ error: err.expose ? err.message : err.code === 11000 ? 'Customer already exists' : err.name === 'ValidationError' ? 'Invalid customer data' : 'Internal server error' });
  }
});

module.exports = router;
