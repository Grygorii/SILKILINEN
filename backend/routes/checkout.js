const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

const SHIPPING_OPTIONS = [
  {
    shipping_rate_data: {
      type: 'fixed_amount',
      fixed_amount: { amount: 499, currency: 'eur' },
      display_name: 'Standard Shipping — Ireland',
      delivery_estimate: {
        minimum: { unit: 'business_day', value: 3 },
        maximum: { unit: 'business_day', value: 5 },
      },
    },
  },
  {
    shipping_rate_data: {
      type: 'fixed_amount',
      fixed_amount: { amount: 999, currency: 'eur' },
      display_name: 'Standard Shipping — EU',
      delivery_estimate: {
        minimum: { unit: 'business_day', value: 5 },
        maximum: { unit: 'business_day', value: 10 },
      },
    },
  },
  {
    shipping_rate_data: {
      type: 'fixed_amount',
      fixed_amount: { amount: 1499, currency: 'eur' },
      display_name: 'Standard Shipping — UK / US / CA / AU',
      delivery_estimate: {
        minimum: { unit: 'business_day', value: 7 },
        maximum: { unit: 'business_day', value: 14 },
      },
    },
  },
  {
    shipping_rate_data: {
      type: 'fixed_amount',
      fixed_amount: { amount: 1999, currency: 'eur' },
      display_name: 'Standard Shipping — Worldwide',
      delivery_estimate: {
        minimum: { unit: 'business_day', value: 10 },
        maximum: { unit: 'business_day', value: 21 },
      },
    },
  },
];

const ALLOWED_COUNTRIES = [
  'IE','GB','US','CA','AU','NZ','DE','FR','IT','ES','NL','BE','AT',
  'PL','SE','DK','NO','FI','PT','CH','GR','HU','CZ','SK','RO','BG',
  'HR','CY','EE','LV','LT','LU','MT','SI',
];

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
      billing_address_collection: 'required',
      shipping_address_collection: { allowed_countries: ALLOWED_COUNTRIES },
      shipping_options: SHIPPING_OPTIONS,
      allow_promotion_codes: true,
      phone_number_collection: { enabled: true },
      success_url: `${FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/cancel`,
    });

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
