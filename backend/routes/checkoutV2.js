const express = require('express');
const rateLimit = require('express-rate-limit');
const checkoutRouter = express.Router();
const webhookRouter = express.Router();
const crypto = require('crypto');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Visit = require('../models/Visit');
const Product = require('../models/Product');
const Expense = require('../models/Expense');
const { calculateShipping } = require('../services/shipping');
const { validateDiscount, redeemDiscount } = require('../services/discounts');
const { calculateTax } = require('../services/tax');
const { sendOrderConfirmation, sendAdminOrderNotification } = require('../services/email');

// 20 intent operations per 5 minutes per IP. Generous enough for normal
// browsing (edit address, change shipping, retry on network error) while
// blocking abuse and price-probing.
const checkoutRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: { error: 'Too many checkout attempts. Please wait a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== 'production',
});

// ── Meta Conversions API ─────────────────────────────────────────────────────
// Fires server-side Purchase event after payment confirmation.
// Deduplicated with client-side fbq('track','Purchase') using matching event_id.
async function fireMetaCapi({ order, eventId }) {
  const pixelId = process.env.META_PIXEL_ID;
  const token   = process.env.META_CONVERSIONS_API_TOKEN;
  if (!pixelId || !token) return; // silently skip if not configured

  try {
    const userData = {};
    if (order.customerEmail) {
      userData.em = [crypto.createHash('sha256').update(order.customerEmail.trim().toLowerCase()).digest('hex')];
    }
    if (order.customerPhone) {
      const phone = order.customerPhone.replace(/[^0-9]/g, '');
      if (phone) userData.ph = [crypto.createHash('sha256').update(phone).digest('hex')];
    }
    if (order.shippingAddress?.country) {
      userData.country = [crypto.createHash('sha256').update(order.shippingAddress.country.toLowerCase()).digest('hex')];
    }

    const payload = {
      data: [{
        event_name:       'Purchase',
        event_time:       Math.floor(Date.now() / 1000),
        event_id:         eventId,
        action_source:    'website',
        user_data:        userData,
        custom_data: {
          currency:  'EUR',
          value:     order.total,
          contents:  (order.items || []).map(i => ({ id: String(i.productId), quantity: i.quantity })),
          content_type: 'product',
        },
      }],
    };

    const url = `https://graph.facebook.com/v18.0/${pixelId}/events?access_token=${token}`;
    await Promise.race([
      fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('CAPI timeout')), 3000)),
    ]);
  } catch (err) {
    console.error('[CAPI] Purchase event failed:', err.message);
  }
}

// POST /api/v2/checkout/create-intent
checkoutRouter.post('/create-intent', checkoutRateLimit, async (req, res) => {
  try {
    const { sessionId, shippingCountry, discountCode: incomingCode, attribution, email } = req.body;
    let cart = null;
    let sourceItems = req.body.items; // direct items path

    if (sessionId) {
      cart = await Cart.findOne({ sessionId });
      if (cart && cart.items.length > 0) {
        sourceItems = cart.items;
      }
    }

    if (!sourceItems || sourceItems.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Re-validate all items against live DB prices
    const validatedItems = [];
    for (const item of sourceItems) {
      const productId = item.productId || item._id;
      const product = await Product.findOne({
        _id: productId,
        status: { $in: ['active', 'sold_out'] },
      }).lean();
      if (!product) {
        return res.status(400).json({ error: `"${item.name}" is no longer available` });
      }
      validatedItems.push({
        productId: product._id,
        name: product.name,
        price: product.price, // authoritative price from DB
        colour: item.colour || '',
        size: item.size || '',
        quantity: item.quantity,
      });
    }

    const subtotal = validatedItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const country = shippingCountry || (cart?.shippingCountry) || 'IE';

    // Re-validate discount if present
    let discountCode = null;
    let discountAmount = 0;
    const codeToTry = incomingCode || cart?.discountCode;
    if (codeToTry) {
      const dr = await validateDiscount(codeToTry, subtotal);
      if (dr.valid) {
        discountCode = dr.code;
        discountAmount = dr.discountAmount;
      }
    }

    const discountedSubtotal = Math.max(0, subtotal - discountAmount);
    const shipping = calculateShipping(country, discountedSubtotal);
    const tax = calculateTax(discountedSubtotal, country);
    const total = discountedSubtotal + shipping.cost;

    // Create Stripe PaymentIntent (amount in cents)
    const intentParams = {
      amount: Math.round(total * 100),
      currency: 'eur',
      metadata: {
        sessionId: sessionId || '',
        discountCode: discountCode || '',
        discountAmount: String(discountAmount),
        shippingCost: String(shipping.cost),
        shippingCountry: country,
        subtotal: String(subtotal),
        // Serialise items so webhook can reconstruct order even without Cart doc
        items: JSON.stringify(validatedItems.map(i => ({
          productId: String(i.productId),
          name: i.name,
          price: i.price,
          colour: i.colour,
          size: i.size,
          quantity: i.quantity,
        }))),
        utm_source:    attribution?.source   ?? 'direct',
        utm_medium:    attribution?.medium   ?? 'none',
        utm_campaign:  attribution?.campaign ?? 'none',
        referrer:      attribution?.referrer ?? '',
        landing_page:  attribution?.landingPage ?? '',
        customerEmail: email || '',
      },
      description: `SILKILINEN order — ${validatedItems.length} item(s)`,
    };
    if (email) intentParams.receipt_email = email;
    const intent = await stripe.paymentIntents.create(intentParams);

    res.json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      orderSummary: {
        items: validatedItems,
        subtotal,
        discountCode,
        discountAmount,
        shipping: { cost: shipping.cost, label: shipping.label, isFree: shipping.isFree },
        tax,
        total,
      },
    });
  } catch (err) {
    console.error('[checkoutV2] create-intent error:', err.message);
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v2/checkout/update-intent
// Updates an existing PaymentIntent's amount when country or discount changes.
// Keeps the same clientSecret so the mounted Elements context is preserved.
checkoutRouter.post('/update-intent', checkoutRateLimit, async (req, res) => {
  try {
    const { paymentIntentId, shippingCountry, discountCode, email } = req.body;
    if (!paymentIntentId) return res.status(400).json({ error: 'paymentIntentId required' });

    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const meta = intent.metadata || {};

    let items = [];
    try { items = JSON.parse(meta.items || '[]'); } catch { /* ignore */ }

    const subtotal = meta.subtotal ? parseFloat(meta.subtotal) : items.reduce((s, i) => s + i.price * i.quantity, 0);
    const country = shippingCountry || meta.shippingCountry || 'IE';

    let discountCodeResult = null;
    let discountAmount = 0;
    // discountCode === '' means "remove"; undefined means "keep existing"
    const codeToTry = discountCode !== undefined ? discountCode : (meta.discountCode || '');
    const knownEmail = email || meta.customerEmail || undefined;
    if (codeToTry) {
      const dr = await validateDiscount(codeToTry, subtotal, knownEmail);
      if (dr.valid) { discountCodeResult = dr.code; discountAmount = dr.discountAmount; }
    }

    const discountedSubtotal = Math.max(0, subtotal - discountAmount);
    const ship = calculateShipping(country, discountedSubtotal);
    const total = discountedSubtotal + ship.cost;

    const updatePayload = {
      amount: Math.round(total * 100),
      metadata: {
        ...meta,
        shippingCountry: country,
        shippingCost: String(ship.cost),
        discountCode: discountCodeResult || '',
        discountAmount: String(discountAmount),
      },
    };
    if (email !== undefined) {
      updatePayload.receipt_email = email || null;
      updatePayload.metadata.customerEmail = email || '';
    }
    await stripe.paymentIntents.update(paymentIntentId, updatePayload);

    res.json({
      orderSummary: {
        items,
        subtotal,
        discountCode: discountCodeResult,
        discountAmount,
        shipping: { cost: ship.cost, label: ship.label, isFree: ship.isFree },
        total,
      },
    });
  } catch (err) {
    console.error('[checkoutV2] update-intent error:', err.message);
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/webhook (mounted at root in server.js — must be before express.json())
webhookRouter.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: `Webhook signature failed: ${err.message}` });
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object;
    const meta = intent.metadata || {};

    try {
      // Guard against duplicate webhooks
      const existing = await Order.findOne({ stripePaymentIntentId: intent.id });
      if (existing) return res.json({ received: true });

      const sessionId = meta.sessionId;
      const [cart, visit] = await Promise.all([
        sessionId ? Cart.findOne({ sessionId }) : Promise.resolve(null),
        sessionId ? Visit.findOne({ sessionId }).sort({ createdAt: -1 }).lean() : Promise.resolve(null),
      ]);

      // Generate a readable order number: SL-YYYYMM-XXXXXX
      const now = new Date();
      const prefix = `SL-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
      const orderNumber = `${prefix}-${rand}`;

      // Use cart items if available; fall back to items serialised in metadata
      let items = [];
      if (cart && cart.items.length > 0) {
        items = cart.items.map(i => ({
          productId: i.productId,
          name: i.name,
          price: i.price,
          colour: i.colour,
          size: i.size,
          quantity: i.quantity,
        }));
      } else if (meta.items) {
        try { items = JSON.parse(meta.items); } catch { /* ignore */ }
      }

      // Snapshot COGS from product costing data at time of sale
      let cogsTotal = null;
      const productIds = items.map(i => i.productId).filter(Boolean);
      if (productIds.length > 0) {
        const products = await Product.find({ _id: { $in: productIds } }).select('costing').lean();
        const costMap = {};
        for (const p of products) {
          costMap[String(p._id)] = p.costing?.totalUnitCost ?? null;
        }
        let allHaveCost = true;
        let sum = 0;
        for (const item of items) {
          const unitCost = costMap[String(item.productId)] ?? null;
          if (unitCost === null) { allHaveCost = false; break; }
          sum += unitCost * (item.quantity || 1);
        }
        cogsTotal = allHaveCost ? sum : null;
      }

      const subtotal = meta.subtotal ? parseFloat(meta.subtotal) : items.reduce((s, i) => s + i.price * i.quantity, 0);
      const discountCode = meta.discountCode || null;
      const discountAmount = meta.discountAmount ? parseFloat(meta.discountAmount) : (discountCode && cart ? (cart.discountAmount || 0) : 0);
      const country = meta.shippingCountry || 'IE';
      const shippingCost = meta.shippingCost ? parseFloat(meta.shippingCost) : calculateShipping(country, Math.max(0, subtotal - discountAmount)).cost;
      const shipping = { cost: shippingCost, label: calculateShipping(country, Math.max(0, subtotal - discountAmount)).label };
      const total = intent.amount / 100;

      const stripeShipping = intent.shipping;
      const customerEmail = intent.receipt_email || intent.metadata?.customerEmail || null;
      const order = await Order.create({
        stripePaymentIntentId: intent.id,
        stripeChargeId: intent.latest_charge,
        orderNumber,
        customerEmail,
        customerName: stripeShipping?.name,
        customerPhone: stripeShipping?.phone,
        shippingAddress: stripeShipping ? {
          name:       stripeShipping.name,
          phone:      stripeShipping.phone,
          line1:      stripeShipping.address?.line1,
          line2:      stripeShipping.address?.line2,
          city:       stripeShipping.address?.city,
          state:      stripeShipping.address?.state,
          postalCode: stripeShipping.address?.postal_code,
          country:    stripeShipping.address?.country,
        } : undefined,
        items,
        subtotal,
        discountCode: discountCode || undefined,
        discountAmount,
        total,
        shippingCost: shippingCost,
        shippingMethod: shipping.label,
        status: 'paid',
        browserSessionId: sessionId,
        costs: { cogs: cogsTotal },
        attribution: {
          source:      meta.utm_source   || 'direct',
          medium:      meta.utm_medium   || 'none',
          campaign:    meta.utm_campaign || 'none',
          referrer:    meta.referrer     || '',
          landingPage: meta.landing_page || '',
        },
        utm: visit?.utm ? {
          source:   visit.utm.source,
          medium:   visit.utm.medium,
          campaign: visit.utm.campaign,
          term:     visit.utm.term,
          content:  visit.utm.content,
        } : undefined,
      });

      // Fire Meta Conversions API server-side Purchase event.
      // fireMetaCapi has its own try/catch, but an unawaited async call
      // still produces unhandled rejections if the inner catch ever throws.
      fireMetaCapi({ order, eventId: `order-${orderNumber}` })
        .catch(err => console.error('[CAPI] unhandled:', err.message));

      // Record redemption (creates PromoCodeRedemption doc + increments usageCount)
      if (discountCode) {
        await redeemDiscount(discountCode, {
          orderId:       order._id,
          orderNumber:   order.orderNumber,
          customerEmail: order.customerEmail,
          discountAmount: order.discountAmount,
        }).catch(() => {});
      }

      // Clear cart
      if (cart) {
        await Cart.deleteOne({ _id: cart._id }).catch(() => {});
      }

      await Promise.allSettled([
        sendOrderConfirmation(order),
        sendAdminOrderNotification(order),
      ]);
    } catch (err) {
      console.error('[checkoutV2 webhook] error:', err.message);
    }
  }

  // Capture Stripe fee from the charge's balance_transaction
  if (event.type === 'charge.succeeded') {
    const charge = event.data.object;
    try {
      if (charge.balance_transaction) {
        const bt = await stripe.balanceTransactions.retrieve(charge.balance_transaction);
        const feeEur = bt.fee / 100; // fee is in cents
        await Order.findOneAndUpdate(
          { stripeChargeId: charge.id },
          { $set: { 'costs.stripeFee': feeEur } }
        );
      }
    } catch (err) {
      console.error('[webhook charge.succeeded] fee capture error:', err.message);
    }
  }

  res.json({ received: true });
});

module.exports = { checkoutRouter, webhookRouter };
