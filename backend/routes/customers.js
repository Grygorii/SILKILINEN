const express = require('express');
const { SITE_URL } = require('../config/site');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');
const Newsletter = require('../models/Newsletter');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { OAuth2Client } = require('google-auth-library');
const { normalizeEmail, ordersForCustomer } = require('../utils/customerIdentity');
const { validateProfile } = require('../utils/customerValidation');
const { CUSTOMER_ORDER_FIELDS, WISHLIST_FIELDS } = require('../utils/customerViews');
const { requireCustomer } = require('../middleware/customerAuth');
const { authRateLimit } = require('../middleware/rateLimits');
const { sendMagicLink, sendWelcome } = require('../services/email');
const { recordWishlistSaves, markWishlistRemoved } = require('../services/wishlistReminders');
const { verify: verifyUnsubscribe } = require('../utils/unsubscribeSign');

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
    const email = normalizeEmail(req.body.email);
    if (!email) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 15 * 60 * 1000);

    const customer = await Customer.findOneAndUpdate(
      { email, gdprDeletedAt: null },
      { $set: { emailVerificationToken: token, emailVerificationExpiry: expiry }, $setOnInsert: { email } },
      { upsert: true, returnDocument: 'after', runValidators: true },
    );

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

    const customer = await Customer.findOneAndUpdate({
      emailVerificationToken: token, emailVerificationExpiry: { $gt: new Date() }, gdprDeletedAt: null,
    }, { $set: { emailVerified: true, emailVerificationToken: null, emailVerificationExpiry: null, lastLogin: new Date() } }, { returnDocument: 'before' });
    if (!customer) return res.status(410).json({ error: 'This link has expired. Please request a new one.' });
    const isFirstLogin = !customer.emailVerified;
    customer.emailVerified = true;
    // Consuming a valid link succeeds even when the optional welcome mail provider is down.
    if (isFirstLogin) await sendWelcome({ email: customer.email, firstName: customer.firstName })
      .catch(() => console.error('[CUSTOMERS] welcome mail failed after successful verification'));

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
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return res.status(503).json({ error: 'Google auth not configured' });
    if (typeof credential !== 'string' || !credential || credential.length > 10000) return res.status(400).json({ error: 'Credential required' });
    let payload;
    try {
      const ticket = await new OAuth2Client(clientId).verifyIdToken({ idToken: credential, audience: clientId });
      payload = ticket.getPayload();
    } catch { return res.status(401).json({ error: 'Invalid Google token' }); }
    const email = normalizeEmail(payload?.email);
    if (!email || payload.email_verified !== true || !payload.sub) return res.status(401).json({ error: 'A verified email address is required' });
    const existing = await Customer.findOne({ email, gdprDeletedAt: null });
    // Google is not authoritative for arbitrary third-party email addresses.
    const authoritativeEmail = email.endsWith('@gmail.com') || Boolean(payload.hd);
    if (!authoritativeEmail && existing?.googleId !== payload.sub) {
      return res.status(401).json({ error: 'Please use the email sign-in link to verify this address.' });
    }
    if (existing?.googleId && existing.googleId !== payload.sub) return res.status(401).json({ error: 'Please use the email sign-in link.' });
    const isFirstLogin = !existing?.emailVerified;
    const fields = { googleId: payload.sub, emailVerified: true, lastLogin: new Date() };
    if (!existing?.firstName) fields.firstName = payload.given_name || '';
    if (!existing?.lastName) fields.lastName = payload.family_name || '';
    const customer = await Customer.findOneAndUpdate(
      { email, gdprDeletedAt: null }, { $set: fields, $setOnInsert: { email, profileSource: 'account' } },
      { upsert: true, returnDocument: 'after', runValidators: true },
    );
    if (isFirstLogin) await sendWelcome({ email: customer.email, firstName: customer.firstName })
      .catch(() => console.error('[CUSTOMERS] welcome mail failed after successful Google sign-in'));

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
    res.status(err.status || (err.name === 'ValidationError' || err.name === 'CastError' ? 400 : 500)).json({ error: err.expose ? err.message : err.name === 'CastError' ? 'Invalid identifier' : 'Internal server error' });
  }
});

// PUT /api/customers/me
router.put('/me', requireCustomer, async function(req, res) {
  try {
    const update = validateProfile(req.body);
    const customer = await Customer.findOneAndUpdate(
      { _id: req.customer.customerId, gdprDeletedAt: null, emailVerified: true },
      { $set: update }, { returnDocument: 'after', runValidators: true },
    );
    if (!customer) return res.status(404).json({ error: 'Not found' });
    if (update.marketingConsent === false) {
      await Newsletter.updateMany(
        { $or: [{ customerId: customer._id }, { email: customer.email }] },
        { $set: { isUnsubscribed: true } },
      );
    }
    res.json(safeCustomer(customer));
  } catch (err) {
    console.error(err);
    res.status(err.status || (err.name === 'ValidationError' || err.name === 'CastError' ? 400 : 500)).json({ error: err.expose ? err.message : err.name === 'CastError' ? 'Invalid identifier' : 'Internal server error' });
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
      ...ordersForCustomer(customer),
      status: { $nin: ['pending', 'failed'] },
    }).select(CUSTOMER_ORDER_FIELDS).sort({ createdAt: -1 }).limit(200).lean();
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(err.status || (err.name === 'ValidationError' || err.name === 'CastError' ? 400 : 500)).json({ error: err.expose ? err.message : err.name === 'CastError' ? 'Invalid identifier' : 'Internal server error' });
  }
});

// GET /api/customers/me/orders/:orderId
router.get('/me/orders/:orderId', requireCustomer, async function(req, res) {
  try {
    if (!/^[0-9a-fA-F]{24}$/.test(req.params.orderId)) return res.status(400).json({ error: 'Invalid order ID' });
    const customer = await Customer.findById(req.customer.customerId);
    if (!customer) return res.status(404).json({ error: 'Not found' });
    const order = await Order.findOne(
      { _id: req.params.orderId, ...ordersForCustomer(customer), status: { $nin: ['pending', 'failed'] } },
      CUSTOMER_ORDER_FIELDS,
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(err.status || (err.name === 'ValidationError' || err.name === 'CastError' ? 400 : 500)).json({ error: err.expose ? err.message : err.name === 'CastError' ? 'Invalid identifier' : 'Internal server error' });
  }
});

// GET /api/customers/me/wishlist
router.get('/me/wishlist', requireCustomer, async function(req, res) {
  try {
    const customer = await Customer.findById(req.customer.customerId).populate({ path: 'wishlist', select: WISHLIST_FIELDS, match: { status: { $in: ['active', 'sold_out'] } } });
    const items = (customer?.wishlist || []).filter(p => p && ['active', 'sold_out'].includes(p.status));
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(err.status || (err.name === 'ValidationError' || err.name === 'CastError' ? 400 : 500)).json({ error: err.expose ? err.message : err.name === 'CastError' ? 'Invalid identifier' : 'Internal server error' });
  }
});

// POST /api/customers/me/wishlist/sync  (must be before /:productId)
router.post('/me/wishlist/sync', requireCustomer, async function(req, res) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length > 100 || ids.some(id => typeof id !== 'string' || !/^[0-9a-fA-F]{24}$/.test(id))) return res.status(400).json({ error: 'At most 100 valid product IDs required' });
    const products = await Product.find({ _id: { $in: [...new Set(ids)] }, status: { $in: ['active', 'sold_out'] } }).select('_id').lean();
    const current = await Customer.findById(req.customer.customerId).select('wishlist').lean();
    const currentIds = new Set((current?.wishlist || []).map(String));
    const addedIds = products.map(product => String(product._id)).filter(id => !currentIds.has(id));
    const update = await Customer.updateOne({ _id: req.customer.customerId, gdprDeletedAt: null }, { $addToSet: { wishlist: { $each: products.map(p => p._id) } } });
    if (update.modifiedCount && addedIds.length) await recordWishlistSaves(req.customer.customerId, addedIds)
      .catch(err => console.error('[wishlist] could not record account save:', err.message));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(err.status || (err.name === 'ValidationError' || err.name === 'CastError' ? 400 : 500)).json({ error: err.expose ? err.message : err.name === 'CastError' ? 'Invalid identifier' : 'Internal server error' });
  }
});

// POST /api/customers/me/wishlist/:productId
router.post('/me/wishlist/:productId', requireCustomer, async function(req, res) {
  try {
    const id = req.params.productId;
    if (!/^[0-9a-fA-F]{24}$/.test(id)) return res.status(400).json({ error: 'Invalid product ID' });
    if (!await Product.exists({ _id: id, status: { $in: ['active', 'sold_out'] } })) return res.status(404).json({ error: 'Product not found' });
    const update = await Customer.updateOne({ _id: req.customer.customerId, gdprDeletedAt: null }, { $addToSet: { wishlist: id } });
    if (update.modifiedCount) await recordWishlistSaves(req.customer.customerId, [id])
      .catch(err => console.error('[wishlist] could not record account save:', err.message));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(err.status || (err.name === 'ValidationError' || err.name === 'CastError' ? 400 : 500)).json({ error: err.expose ? err.message : err.name === 'CastError' ? 'Invalid identifier' : 'Internal server error' });
  }
});

// DELETE /api/customers/me/wishlist/:productId
router.delete('/me/wishlist/:productId', requireCustomer, async function(req, res) {
  try {
    await Customer.findByIdAndUpdate(req.customer.customerId, {
      $pull: { wishlist: req.params.productId },
    });
    await markWishlistRemoved(req.customer.customerId, req.params.productId)
      .catch(err => console.error('[wishlist] could not record account removal:', err.message));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(err.status || (err.name === 'ValidationError' || err.name === 'CastError' ? 400 : 500)).json({ error: err.expose ? err.message : err.name === 'CastError' ? 'Invalid identifier' : 'Internal server error' });
  }
});

// GET/POST /api/customers/unsubscribe?cid=<base64url>&sig=<hmac>
//
// Opt out of MARKETING email (winback, campaigns). GDPR Art. 21(2) and PECR
// require an opt-out in every marketing message, and the winback email carried
// none — the audience was correctly gated on marketingConsent, but a recipient
// had no way to withdraw it except by writing to us.
//
// Scoped signature, so a cart-recovery link cannot be replayed here. No auth:
// the whole point is that it works from an inbox, and the HMAC is what makes it
// unforgeable. Never reveals whether the customer exists.
async function unsubscribeCustomer(req, res) {
  try {
    const { cid, sig } = req.query;
    if (typeof cid !== 'string' || !cid) return res.status(400).send('Missing reference.');

    const customerId = Buffer.from(cid, 'base64url').toString('utf8');
    if (!/^[0-9a-fA-F]{24}$/.test(customerId) || !verifyUnsubscribe(customerId, sig, 'customer')) {
      return res.status(403).send('This link is invalid.');
    }

    const customer = await Customer.findById(customerId).select('_id email').lean();
    if (customer) {
      await Customer.updateOne({ _id: customer._id }, { $set: { marketingConsent: false } });
      await Newsletter.updateMany(
        { $or: [{ customerId: customer._id }, { email: customer.email }] },
        { $set: { isUnsubscribed: true } },
      );
    }

    // RFC 8058 one-click unsubscribe requests are provider POSTs, not browser
    // navigation. Return a small successful response without rendering a page.
    if (req.method === 'POST') return res.status(200).type('text/plain').send('Unsubscribed');

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
}

router.get('/unsubscribe', unsubscribeCustomer);
router.post('/unsubscribe', unsubscribeCustomer);

module.exports = router;
