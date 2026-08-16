const express = require('express');
const { SITE_URL } = require('../config/site');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const { requireCustomer } = require('../middleware/customerAuth');
const { authRateLimit } = require('../middleware/rateLimits');
const { sendMagicLink, sendWelcome } = require('../services/email');

const SECRET = process.env.JWT_CUSTOMER_SECRET; // fatal-exit guard is in middleware/customerAuth.js
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
router.post('/request-magic-link', authRateLimit, async function(req, res) {
  try {
    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

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

    const baseUrl = SITE_URL;
    await sendMagicLink({ email: customer.email, link: `${baseUrl}/account/verify?token=${token}` });

    res.json({ success: true });
  } catch (err) {
    console.error(`[CUSTOMERS] request-magic-link error: ${err.message}`);
    res.status(503).json({ error: 'Something went wrong on our end. Please try again in a moment.' });
  }
});

// POST /api/customers/verify-magic-link
router.post('/verify-magic-link', authRateLimit, async function(req, res) {
  try {
    const { token } = req.body;
    if (typeof token !== 'string' || !token) return res.status(400).json({ error: 'Token required' });

    const customer = await Customer.findOne({
      emailVerificationToken: token,
      emailVerificationExpiry: { $gt: new Date() },
    });
    if (!customer) return res.status(410).json({ error: 'This link has expired. Please request a new one.' });

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
    console.error(`[CUSTOMERS] verify-magic-link error: ${err.message}`);
    res.status(503).json({ error: 'Something went wrong on our end. Please try again in a moment.' });
  }
});

// POST /api/customers/google
router.post('/google', authRateLimit, async function(req, res) {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Credential required' });

    const gRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
    const payload = await gRes.json();
    if (!gRes.ok || !payload.email) return res.status(400).json({ error: 'Invalid Google token' });

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(503).json({ error: 'Google auth not configured' });
    }
    if (payload.aud !== clientId) {
      return res.status(401).json({ error: 'Invalid token audience' });
    }
    const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
    if (!validIssuers.includes(payload.iss)) {
      return res.status(401).json({ error: 'Invalid token issuer' });
    }

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
    console.error(`[CUSTOMERS] google auth error: ${err.message}`);
    res.status(503).json({ error: 'Something went wrong on our end. Please try again in a moment.' });
  }
});

// GET /api/customers/me
router.get('/me', requireCustomer, async function(req, res) {
  try {
    const customer = await Customer.findById(req.customer.customerId);
    if (!customer) return res.status(404).json({ error: 'Not found' });
    res.json(safeCustomer(customer));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
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
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
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
    const orders = await Order.find({
      customerEmail: customer.email,
      status: { $nin: ['pending', 'failed'] },
    }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/customers/me/orders/:orderId
router.get('/me/orders/:orderId', requireCustomer, async function(req, res) {
  try {
    const customer = await Customer.findById(req.customer.customerId);
    if (!customer) return res.status(404).json({ error: 'Not found' });
    const order = await Order.findOne(
      { _id: req.params.orderId, customerEmail: customer.email },
      { internalNote: 0 },
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/customers/me/wishlist
router.get('/me/wishlist', requireCustomer, async function(req, res) {
  try {
    const customer = await Customer.findById(req.customer.customerId).populate('wishlist');
    const items = (customer?.wishlist || []).filter(p => p.status !== 'draft' && p.status !== 'archived');
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
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
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
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
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
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
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/customers/unsubscribe?cid=<base64url>&sig=<hmac>
//
// Opt out of MARKETING email (winback, campaigns). GDPR Art. 21(2) and PECR
// require an opt-out in every marketing message, and the winback email carried
// none — the audience was correctly gated on marketingConsent, but a recipient
// had no way to withdraw it except by writing to us.
//
// Scoped signature, so a cart-recovery link cannot be replayed here. No auth:
// the whole point is that it works from an inbox, and the HMAC is what makes it
// unforgeable. Never reveals whether the customer exists.
router.get('/unsubscribe', async function(req, res) {
  try {
    const { cid, sig } = req.query;
    if (typeof cid !== 'string' || !cid) return res.status(400).send('Missing reference.');

    const customerId = Buffer.from(cid, 'base64url').toString('utf8');
    const { verify } = require('../utils/unsubscribeSign');
    if (!verify(customerId, sig, 'customer')) return res.status(403).send('This link is invalid.');

    await Customer.updateOne({ _id: customerId }, { $set: { marketingConsent: false } }).catch(() => {});

    res.set('Content-Type', 'text/html').send(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribed</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#FAF8F4;color:#2A2218;font-family:Georgia,serif;text-align:center;padding:40px">
<div><p style="font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:#6B6358;margin:0 0 20px">SILKILINEN</p>
<h1 style="font-size:30px;font-weight:300;margin:0 0 12px">You're unsubscribed.</h1>
<p style="font-size:15px;color:#6B6358;line-height:1.6;margin:0">You won't receive marketing email from us again.<br>Order updates still reach you, as they must.</p>
</div></body></html>`);
  } catch (err) {
    console.error('[customer unsubscribe]', err.message);
    res.status(500).send('Something went wrong. Please try again.');
  }
});

module.exports = router;
