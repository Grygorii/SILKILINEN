const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

router.post('/', async function(req, res) {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    for (const item of items) {
      if (!item.name || typeof item.price !== 'number' || item.price <= 0 || item.quantity < 1) {
        return res.status(400).json({ error: 'Invalid cart item' });
      }
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: items.map(item => ({
        price_data: {
          currency: 'eur',
          product_data: {
            name: item.name,
            description: [item.colour, item.size].filter(Boolean).join(' / ') || undefined,
          },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      })),
      mode: 'payment',
      success_url: `${FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/cancel`,
    });

    // Save a pending order so the webhook can enrich it without hitting Stripe metadata limits.
    await Order.create({
      stripeSessionId: session.id,
      items: items.map(({ name, price, colour, size, quantity }) => ({ name, price, colour, size, quantity })),
      total: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      status: 'pending',
    });

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
