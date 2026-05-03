const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const { requireCustomer } = require('../middleware/customerAuth');
const { sendMagicLink, sendWelcome } = require('../services/email');

const SECRET = process.env.JWT_CUSTOMER_SECRET || 'silkilinen_customer_secret_change_in_prod';
const IS_PROD = process.env.NODE_ENV === 'production';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: IS_PROD ? 'none' : 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

function setCustomerCookie(res, customer) {
  const token = jwt.sign({ customerId: String(customer._id) }, SECRET, { expiresIn: '30d' });
  res.cookie('customer_token', token, COOKIE_OPTS);
}

function safeCustomer(c) {
  return {
    _id: c._id,
    email: c.email,
    firstName: c.firstName,
    lastName: c.lastName,
    phone: c.phone,
    defaultShippingAddress: c.defaultShippingAddress,
    marketingConsent: c.marketingConsent,
    emailVerified: c.emailVerified,
    wishlist: c.wishlist,
    createdAt: c.createdAt,
  };
}

// POST /api/customers/request-magic-link
router.post('/request-magic-link', async function(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 15 * 60 * 1000);

    let customer = await Customer.findOne({ email: email.toLowerCase() });
    if (!customer) {
      customer = await Customer.create({
        email: email.toLowerCase(),
        emailVerificationToken: token,
        emailVerificationExpiry: expiry,
      });
    } else {
      customer.emailVerificationToken = token;
      customer.emailVerificationExpiry = expiry;
      await customer.save();
    }

    const baseUrl = process.env.FRONTEND_URL || 'https://silkilinen.vercel.app';
    await sendMagicLink({ email: customer.email, link: `${baseUrl}/account/verify?token=${token}` });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customers/verify-magic-link
router.post('/verify-magic-link', async function(req, res) {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });

    const customer = await Customer.findOne({
      emailVerificationToken: token,
      emailVerificationExpiry: { $gt: new Date() },
    });
    if (!customer) return res.status(400).json({ error: 'Link expired or already used' });

    const isFirstLogin = !customer.emailVerified;
    customer.emailVerified = true;
    customer.emailVerificationToken = null;
    customer.emailVerificationExpiry = null;
    customer.lastLogin = new Date();
    await customer.save();

    if (isFirstLogin) {
      await sendWelcome({ email: customer.email, firstName: customer.firstName });
    }

    setCustomerCookie(res, customer);
    res.json({ success: true, customer: safeCustomer(customer), isFirstLogin });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customers/google
router.post('/google', async function(req, res) {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Credential required' });

    const gRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
    const payload = await gRes.json();
    if (!gRes.ok || !payload.email) return res.status(400).json({ error: 'Invalid Google token' });

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (clientId && payload.aud !== clientId) return res.status(400).json({ error: 'Token audience mismatch' });

    let customer = await Customer.findOne({ email: payload.email.toLowerCase() });
    const isFirstLogin = !customer;

    if (!customer) {
      customer = await Customer.create({
        email: payload.email.toLowerCase(),
        googleId: payload.sub,
        firstName: payload.given_name || '',
        lastName: payload.family_name || '',
        emailVerified: true,
      });
      await sendWelcome({ email: customer.email, firstName: customer.firstName });
    } else {
      if (!customer.googleId) customer.googleId = payload.sub;
      customer.lastLogin = new Date();
      await customer.save();
    }

    setCustomerCookie(res, customer);
    res.json({ success: true, customer: safeCustomer(customer), isFirstLogin });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/customers/me
router.get('/me', requireCustomer, async function(req, res) {
  try {
    const customer = await Customer.findById(req.customer.customerId);
    if (!customer) return res.status(404).json({ error: 'Not found' });
    res.json(safeCustomer(customer));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/customers/me
router.put('/me', requireCustomer, async function(req, res) {
  try {
    const { firstName, lastName, phone, marketingConsent, defaultShippingAddress } = req.body;
    const customer = await Customer.findByIdAndUpdate(
      req.customer.customerId,
      { firstName, lastName, phone, marketingConsent, defaultShippingAddress },
      { new: true }
    );
    res.json(safeCustomer(customer));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customers/logout
router.post('/logout', function(req, res) {
  res.clearCookie('customer_token', {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? 'none' : 'lax',
    path: '/',
  });
  res.json({ success: true });
});

// GET /api/customers/me/orders
router.get('/me/orders', requireCustomer, async function(req, res) {
  try {
    const customer = await Customer.findById(req.customer.customerId);
    if (!customer) return res.status(404).json({ error: 'Not found' });
    const orders = await Order.find({ customerEmail: customer.email, status: 'paid' }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/customers/me/orders/:orderId
router.get('/me/orders/:orderId', requireCustomer, async function(req, res) {
  try {
    const customer = await Customer.findById(req.customer.customerId);
    if (!customer) return res.status(404).json({ error: 'Not found' });
    const order = await Order.findOne({ _id: req.params.orderId, customerEmail: customer.email });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/customers/me/wishlist
router.get('/me/wishlist', requireCustomer, async function(req, res) {
  try {
    const customer = await Customer.findById(req.customer.customerId).populate('wishlist');
    res.json(customer?.wishlist || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customers/me/wishlist/sync  (must be before /:productId)
router.post('/me/wishlist/sync', requireCustomer, async function(req, res) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.json({ success: true });
    const customer = await Customer.findById(req.customer.customerId);
    const existing = customer.wishlist.map(id => id.toString());
    const toAdd = ids.filter(id => !existing.includes(id));
    if (toAdd.length > 0) {
      customer.wishlist.push(...toAdd);
      await customer.save();
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customers/me/wishlist/:productId
router.post('/me/wishlist/:productId', requireCustomer, async function(req, res) {
  try {
    const customer = await Customer.findById(req.customer.customerId);
    const id = req.params.productId;
    if (!customer.wishlist.map(x => x.toString()).includes(id)) {
      customer.wishlist.push(id);
      await customer.save();
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/customers/me/wishlist/:productId
router.delete('/me/wishlist/:productId', requireCustomer, async function(req, res) {
  try {
    await Customer.findByIdAndUpdate(req.customer.customerId, {
      $pull: { wishlist: req.params.productId },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
