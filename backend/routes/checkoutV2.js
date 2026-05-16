const express = require('express');
const checkoutRouter = express.Router();
const webhookRouter = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { calculateShipping } = require('../services/shipping');
const { validateDiscount, redeemDiscount } = require('../services/discounts');
const { calculateTax } = require('../services/tax');
const { sendOrderConfirmation, sendAdminOrderNotification } = require('../services/email');

// POST /api/v2/checkout/create-intent
checkoutRouter.post('/create-intent', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v2/checkout/update-intent
// Updates an existing PaymentIntent's amount when country or discount changes.
// Keeps the same clientSecret so the mounted Elements context is preserved.
checkoutRouter.post('/update-intent', async (req, res) => {
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
    if (codeToTry) {
      const dr = await validateDiscount(codeToTry, subtotal);
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
    res.status(500).json({ error: err.message });
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
      const cart = sessionId ? await Cart.findOne({ sessionId }) : null;

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
        attribution: {
          source:      meta.utm_source   || 'direct',
          medium:      meta.utm_medium   || 'none',
          campaign:    meta.utm_campaign || 'none',
          referrer:    meta.referrer     || '',
          landingPage: meta.landing_page || '',
        },
      });

      // Increment discount usage
      if (discountCode) {
        await redeemDiscount(discountCode).catch(() => {});
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

  res.json({ received: true });
});

module.exports = { checkoutRouter, webhookRouter };
